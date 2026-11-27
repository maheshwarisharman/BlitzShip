"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  invalid = false,
  id = "otp-code",
}: OtpInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, idx) => value[idx] ?? "");

  const focusIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(length - 1, index));
    inputsRef.current[clamped]?.focus();
    inputsRef.current[clamped]?.select();
  };

  const updateDigit = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      const next = digits.map((d, i) => (i === index ? "" : d)).join("");
      onChange(next);
      return;
    }

    if (cleaned.length > 1) {
      const merged = cleaned.slice(0, length);
      onChange(merged);
      focusIndex(Math.min(merged.length, length - 1));
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = cleaned;
    onChange(nextDigits.join(""));
    if (index < length - 1) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        e.preventDefault();
        const nextDigits = [...digits];
        nextDigits[index - 1] = "";
        onChange(nextDigits.join(""));
        focusIndex(index - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusIndex(index - 1);
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      focusIndex(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    focusIndex(Math.min(pasted.length, length - 1));
  };

  return (
    <div className="grid grid-cols-6 gap-2" role="group" aria-label="Verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          id={index === 0 ? id : `${id}-${index}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={length}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={digit}
          onChange={(e) => updateDigit(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "h-12 w-full rounded-lg border bg-ink text-center font-mono text-lg font-medium tracking-widest text-white transition-colors outline-none",
            "placeholder:text-white/20 disabled:cursor-not-allowed disabled:opacity-50",
            invalid
              ? "border-red-500/70 focus:border-red-400"
              : "border-line focus:border-bolt focus:ring-2 focus:ring-bolt/25",
          )}
        />
      ))}
    </div>
  );
}
