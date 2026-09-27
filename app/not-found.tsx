"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** عربية لطيفة بتتحرك في مكانها — عيون بترمش، عجلات بتلف، ودخان خفيف ورا. */
function LostBusCharacter() {
  return (
    <svg
      viewBox="0 0 340 210"
      role="img"
      aria-label="عربية اتوهت في الطريق"
      className="mx-auto w-full max-w-md drop-shadow-[0_24px_40px_rgba(0,19,76,0.18)]"
    >
      {/* الطريق */}
      <rect x="16" y="172" width="308" height="12" rx="6" fill="#dbe9f4" />
      <line x1="28" y1="178" x2="312" y2="178" stroke="#00134c" strokeOpacity="0.25" strokeWidth="3" strokeDasharray="22 20" strokeLinecap="round" />

      {/* دخان من الشمال */}
      <circle className="notfound-puff" cx="52" cy="150" r="9" fill="#c9d8e4" />
      <circle className="notfound-puff" cx="52" cy="150" r="7" fill="#d8e4ee" style={{ animationDelay: "0.5s" }} />
      <circle className="notfound-puff" cx="52" cy="150" r="11" fill="#c2d3e0" style={{ animationDelay: "1s" }} />

      {/* علامة استفهام طايرة */}
      <text x="286" y="64" textAnchor="middle" fontSize="40" fontWeight="800" fill="#059ff8" className="notfound-mark">؟</text>

      {/* العربية كلها بتنطّ */}
      <g className="notfound-bus">
        {/* جسم العربية */}
        <rect x="64" y="66" width="196" height="92" rx="20" fill="#00134c" />
        <rect x="64" y="94" width="196" height="12" fill="#059ff8" opacity="0.9" />
        <rect x="56" y="148" width="212" height="10" rx="5" fill="#059ff8" />

        {/* الزجاج */}
        <rect x="80" y="76" width="118" height="50" rx="12" fill="#dff1fd" />

        {/* العيون — بترمش */}
        <g className="notfound-eye">
          <circle cx="112" cy="102" r="13" fill="#ffffff" />
          <circle cx="112" cy="104" r="6" fill="#00134c" />
          <circle cx="114" cy="101" r="2" fill="#ffffff" />
        </g>
        <g className="notfound-eye" style={{ animationDelay: "0.15s" }}>
          <circle cx="152" cy="102" r="13" fill="#ffffff" />
          <circle cx="152" cy="104" r="6" fill="#00134c" />
          <circle cx="154" cy="101" r="2" fill="#ffffff" />
        </g>
        {/* فم مستغرب */}
        <ellipse cx="132" cy="118" rx="9" ry="5" fill="#00134c" opacity="0.35" />

        {/* الباب */}
        <rect x="210" y="80" width="34" height="70" rx="9" fill="#059ff8" opacity="0.85" />
        <line x1="227" y1="86" x2="227" y2="144" stroke="#00134c" strokeOpacity="0.4" strokeWidth="2" />

        {/* فانوس + لوحة 404 */}
        <circle cx="252" cy="138" r="6" fill="#facc15" />
        <rect x="222" y="150" width="30" height="14" rx="4" fill="#ffffff" />
        <text x="237" y="161" textAnchor="middle" fontSize="9" fontWeight="800" fill="#00134c">404</text>

        {/* العجل — بتلف */}
        <g>
          <circle cx="108" cy="162" r="17" fill="#17212b" />
          <circle cx="108" cy="162" r="8" fill="#d8e4ee" />
          <g className="notfound-wheel">
            <rect x="106.5" y="150" width="3" height="24" rx="1.5" fill="#8b98a5" />
            <rect x="96" y="160.5" width="24" height="3" rx="1.5" fill="#8b98a5" />
          </g>
        </g>
        <g>
          <circle cx="212" cy="162" r="17" fill="#17212b" />
          <circle cx="212" cy="162" r="8" fill="#d8e4ee" />
          <g className="notfound-wheel">
            <rect x="210.5" y="150" width="3" height="24" rx="1.5" fill="#8b98a5" />
            <rect x="200" y="160.5" width="24" height="3" rx="1.5" fill="#8b98a5" />
          </g>
        </g>
      </g>
    </svg>
  );
}

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="page-bg flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <LostBusCharacter />

      <p className="title-grad mt-4 text-6xl font-extrabold tracking-tight sm:text-7xl" dir="ltr">
        404
      </p>
      <h1 className="mt-3 text-2xl font-extrabold text-[#00134c] sm:text-3xl">
        العربية جت على طريق مغلق!
      </h1>
      <p className="mt-3 max-w-md text-sm leading-7 text-[#5e6b78] sm:text-base">
        الصفحة اللي بتدور عليها مش موجودة — يا اللينك اللي معاك غلط، يا الصفحة اتنقلت من مكانها.
        مفيش مشكلة، خد اللينك ده وارجع تاني.
      </p>

      <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/">ارجع للوحة التحكم</Link>
        </Button>
        <Button type="button" size="lg" variant="secondary" onClick={() => router.back()}>
          ارجع خطوة للوراء
        </Button>
      </div>
    </div>
  );
}
