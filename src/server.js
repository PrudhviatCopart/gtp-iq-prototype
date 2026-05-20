import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const continueBaseUrl = process.env.CONTINUE_BASE_URL || "https://www.cashforcars.com/instaquote/";
const secretKey = process.env.SECRET_KEY || "prototype-key";

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(express.static("public"));

const mileageBuckets = [
  { max: 60000, factor: 1.08 },
  { max: 120000, factor: 1.0 },
  { max: 180000, factor: 0.88 },
  { max: Infinity, factor: 0.76 }
];

const titleTypeFactors = {
  clean: 1.0,
  rebuilt: 0.78,
  salvage: 0.6,
  no_title: 0.45
};

const startsDrivesFactors = {
  starts_and_drives: 1.0,
  starts_no_drive: 0.8,
  no_start: 0.62
};

const binaryFactors = {
  yes: 1.0,
  no: 0.9
};

function priceModel(input) {
  const year = Number(input.year);
  const mileage = Number(input.mileage);
  const make = String(input.make || "").toLowerCase();
  const model = String(input.model || "").toLowerCase();
  const trim = String(input.trim || "").toLowerCase();

  const age = Math.max(0, new Date().getFullYear() - year);
  let basePrice = 12000 - age * 650;

  if (make.includes("toyota") || make.includes("honda")) {
    basePrice += 900;
  }
  if (make.includes("bmw") || make.includes("mercedes") || make.includes("audi")) {
    basePrice += 700;
  }
  if (model.includes("truck") || model.includes("f150") || model.includes("silverado")) {
    basePrice += 1000;
  }
  if (trim.includes("limited") || trim.includes("touring") || trim.includes("platinum")) {
    basePrice += 500;
  }

  const mileageFactor = mileageBuckets.find((b) => mileage <= b.max)?.factor ?? 0.76;
  const titleFactor = titleTypeFactors[input.titleType] ?? 0.6;
  const startsDrivesFactor = startsDrivesFactors[input.startsDrives] ?? 0.62;
  const keysFactor = binaryFactors[input.keysAvailable] ?? 0.9;
  const damageFactor = input.hasDamage === "yes" ? 0.82 : 1.0;

  const raw = Math.max(250, basePrice * mileageFactor * titleFactor * startsDrivesFactor * keysFactor * damageFactor);
  const rounded = Math.round(raw / 50) * 50;

  return {
    minOffer: Math.max(200, rounded - 250),
    maxOffer: rounded + 250,
    firmOffer: rounded,
    confidence: raw > 7000 ? "high" : raw > 3500 ? "medium" : "low"
  };
}

function validateQuoteInput(body) {
  const required = [
    "year",
    "make",
    "model",
    "trim",
    "titleType",
    "mileage",
    "startsDrives",
    "outstandingLoan",
    "keysAvailable",
    "hasDamage",
    "zipCode"
    ,"phoneNumber"
  ];

  const missing = required.filter((k) => body[k] === undefined || body[k] === null || body[k] === "");
  if (missing.length) {
    return `Missing required fields: ${missing.join(", ")}`;
  }

  const year = Number(body.year);
  const mileage = Number(body.mileage);
  if (Number.isNaN(year) || year < 1980 || year > new Date().getFullYear() + 1) {
    return "Invalid year";
  }
  if (Number.isNaN(mileage) || mileage < 0 || mileage > 500000) {
    return "Invalid mileage";
  }

  if (!/^[0-9]{5}$/.test(String(body.zipCode))) {
    return "Invalid zipCode. Expected 5-digit US ZIP";
  }

  const titleTypes = ["clean", "salvage", "rebuilt", "no_title"];
  if (!titleTypes.includes(String(body.titleType))) {
    return "Invalid titleType. Use clean, salvage, rebuilt, or no_title";
  }

  const startsDrivesValues = ["starts_and_drives", "starts_no_drive", "no_start"];
  if (!startsDrivesValues.includes(String(body.startsDrives))) {
    return "Invalid startsDrives. Use starts_and_drives, starts_no_drive, or no_start";
  }

  const yesNo = ["yes", "no"];
  if (!yesNo.includes(String(body.outstandingLoan))) {
    return "Invalid outstandingLoan. Use yes or no";
  }
  if (!yesNo.includes(String(body.keysAvailable))) {
    return "Invalid keysAvailable. Use yes or no";
  }
  if (!yesNo.includes(String(body.hasDamage))) {
    return "Invalid hasDamage. Use yes or no";
  }

  const digits = String(body.phoneNumber).replace(/\D/g, "");
  if (digits.length !== 10 && digits.length !== 11) {
    return "Invalid phoneNumber. Provide a valid US phone number";
  }

  return null;
}

function signPayload(payload) {
  const json = JSON.stringify(payload);
  return crypto.createHmac("sha256", secretKey).update(json).digest("hex");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "gpt-instaquote-prototype" });
});

app.post("/api/quote", (req, res) => {
  const error = validateQuoteInput(req.body || {});
  if (error) {
    return res.status(400).json({ ok: false, error });
  }

  if (String(req.body.outstandingLoan) === "yes") {
    return res.json({
      ok: true,
      eligible: false,
      reason: "Vehicle has an outstanding loan. No instant offer generated.",
      nextStep: "Collect payoff details and route to assisted flow."
    });
  }

  const quote = priceModel(req.body);
  const quoteId = crypto.randomUUID();
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const tokenPayload = {
    quoteId,
    year: Number(req.body.year),
    make: String(req.body.make),
    model: String(req.body.model),
    trim: String(req.body.trim),
    mileage: Number(req.body.mileage),
    titleType: String(req.body.titleType),
    startsDrives: String(req.body.startsDrives),
    keysAvailable: String(req.body.keysAvailable),
    hasDamage: String(req.body.hasDamage),
    zipCode: String(req.body.zipCode),
    phoneNumber: String(req.body.phoneNumber),
    firmOffer: quote.firmOffer,
    issuedAt,
    expiresAt
  };

  const signature = signPayload(tokenPayload);
  const encoded = Buffer.from(JSON.stringify({ payload: tokenPayload, signature })).toString("base64url");

  const acceptUrl = `${continueBaseUrl}?source=gpt-prototype&quoteToken=${encoded}`;

  return res.json({
    ok: true,
    quoteId,
    ...quote,
    currency: "USD",
    acceptUrl,
    expiresAt,
    disclaimers: [
      "Prototype estimate only.",
      "Final offer may change after in-person inspection.",
      "Offer expires in 15 minutes."
    ]
  });
});

app.post("/api/accept", (req, res) => {
  const quoteId = String(req.body?.quoteId || "").trim();
  if (!quoteId) {
    return res.status(400).json({ ok: false, error: "quoteId is required" });
  }

  return res.json({
    ok: true,
    message: "Quote marked as accepted (prototype).",
    nextStep: "Redirect user to the website lead flow.",
    quoteId
  });
});

app.listen(port, () => {
  console.log(`Prototype quote API running on http://localhost:${port}`);
});
