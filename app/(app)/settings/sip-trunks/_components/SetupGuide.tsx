import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupGuide() {
  return (
    <Card className="bg-[#f9f9f9] border-[#e8e8e8]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#0a0a0a]">
          Where to find these values in Squaretalk
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-[#6b6b6b] space-y-1.5">
        <p>
          1. Log in to Squaretalk → <strong>Settings</strong> →{" "}
          <strong>SIP Trunk</strong>
        </p>
        <p>
          2. Copy the <strong>SIP server URL</strong> and <strong>port</strong>{" "}
          into the URL and Port fields above.
        </p>
        <p>
          3. Copy the <strong>username</strong> and <strong>password</strong>{" "}
          shown there.
        </p>
        <p>
          4. The <strong>Net mask</strong> is usually{" "}
          <code className="bg-[#f0f0f0] px-1 rounded">32</code> (single IP) —
          set a smaller value only if Squaretalk tells you to.
        </p>
        <p>
          5. <strong>Protocol</strong> is usually{" "}
          <code className="bg-[#f0f0f0] px-1 rounded">UDP</code> unless
          Squaretalk specifies otherwise.
        </p>
      </CardContent>
    </Card>
  );
}
