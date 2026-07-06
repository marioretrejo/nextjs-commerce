import Link from "next/link";
import { PLANS, SERIF } from "./data";

export function Pricing() {
  return (
    <section
      className="border-t border-black/8 bg-white px-6 py-28 sm:px-12"
      id="pricing"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 flex items-end justify-between border-b border-black/10 pb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#888]">
            Pricing
          </p>
          <h2
            className="text-2xl font-light tracking-tight sm:text-3xl text-black"
            style={SERIF}
          >
            Simple, transparent pricing
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-3 border border-black/15">
          {PLANS.map((plan, i) => (
            <div
              key={plan.name}
              className={`relative p-8 ${
                plan.highlight ? "bg-black text-white" : "bg-white text-black"
              } ${i > 0 ? "border-l border-black/15" : ""}`}
            >
              {plan.highlight && (
                <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-[#888]">
                  Most popular
                </p>
              )}
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-[#888]">
                {plan.name}
              </p>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-light" style={SERIF}>
                  {plan.price}
                </span>
                {plan.price !== "$0" && (
                  <span className="mb-1 text-xs text-[#888]">
                    /{plan.period.split(" ")[0]}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-[#888]">{plan.desc}</p>
              <ul className="my-7 space-y-2.5">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2 text-xs leading-relaxed ${plan.highlight ? "text-[#bbb]" : "text-[#555]"}`}
                  >
                    <span
                      className={`mt-0.5 shrink-0 ${plan.highlight ? "text-white" : "text-black"}`}
                    >
                      -
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <button
                  className={`w-full border py-2.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                    plan.highlight
                      ? "border-white bg-white text-black hover:bg-[#f2f2f2]"
                      : "border-black bg-transparent text-black hover:bg-black hover:text-white"
                  }`}
                >
                  {plan.cta}
                </button>
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs text-[#888]">
          Start free. Scale when you&apos;re ready. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
