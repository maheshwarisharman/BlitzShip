import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export const requireAuth = () => (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
  next();
};

/**
 * Guards service-to-service routes (e.g. build-worker -> primary-backend) with a shared
 * secret sent in the `x-internal-secret` header. Fails closed when the secret is not configured.
 */
export const requireInternalSecret = () => (req: Request, res: Response, next: NextFunction) => {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    console.error("[auth] INTERNAL_API_SECRET is not set; rejecting internal request");
    return res.status(500).json({
      success: false,
      message: "Internal API secret is not configured",
    });
  }

  const provided = req.header("x-internal-secret");
  if (!provided || !secretsMatch(provided, expected)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
  next();
};

// Hashing first gives equal-length buffers, so timingSafeEqual never leaks the secret's length
function secretsMatch(provided: string, expected: string): boolean {
  const a = crypto.createHash("sha256").update(provided).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
