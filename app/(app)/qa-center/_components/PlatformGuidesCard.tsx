"use client";

import { Card, CardContent } from "@/components/ui/card";

export function PlatformGuidesCard() {
  return (
    <Card className="border-dashed border-[#e0e0e0]">
      <CardContent className="py-4 px-5">
        <p className="text-xs font-semibold text-[#555] mb-2">
          Platform Setup Guides
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs text-[#6b6b6b]">
          <div>
            <p className="font-medium text-[#333] mb-1">Squaretalk</p>
            <p>
              Settings → Webhooks → Call Events → paste webhook URL. Use
              &ldquo;Squaretalk&rdquo; preset above.
            </p>
          </div>
          <div>
            <p className="font-medium text-[#333] mb-1">Voiso</p>
            <p>
              Settings → Integrations → Webhooks → Call Completed. Use
              &ldquo;Voiso&rdquo; preset above.
            </p>
          </div>
          <div>
            <p className="font-medium text-[#333] mb-1">Twilio</p>
            <p>
              Phone Numbers → Recording Status Callback. Default mappings work
              out of the box.
            </p>
          </div>
          <div>
            <p className="font-medium text-[#333] mb-1">Custom SIP / Other</p>
            <p>
              Send any JSON or form-encoded POST. Map your field names using the
              editor above.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
