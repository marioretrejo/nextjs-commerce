import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import type { Contact } from "./types";

export function StepContacts({
  contacts,
  onCSV,
  onClear,
}: {
  contacts: Contact[];
  onCSV: (file: File) => void;
  onClear: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Contacts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[#6b6b6b]">
          Upload a CSV with columns:{" "}
          <code className="bg-[#f5f5f5] px-1 rounded text-xs">
            name, phone, email
          </code>
          . Additional columns become dynamic variables.
        </p>
        <div
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#e0e0e0] py-12 cursor-pointer hover:border-[#0a0a0a] transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) onCSV(f);
          }}
        >
          <Upload className="h-8 w-8 text-[#6b6b6b] mb-3" />
          <p className="text-sm font-medium">Click or drag CSV file here</p>
          <p className="text-xs text-[#6b6b6b]">Max 10,000 contacts</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCSV(f);
            }}
          />
        </div>

        {contacts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                {contacts.length} contacts loaded
              </p>
              <Button variant="ghost" size="sm" onClick={onClear}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-hidden rounded-md border border-[#e0e0e0]">
              <table className="w-full text-xs">
                <thead className="bg-[#f5f5f5]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Phone</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.slice(0, 5).map((c, i) => (
                    <tr key={i} className="border-t border-[#e0e0e0]">
                      <td className="px-3 py-2">{c.name ?? "—"}</td>
                      <td className="px-3 py-2">{c.phone}</td>
                      <td className="px-3 py-2">{c.email ?? "—"}</td>
                    </tr>
                  ))}
                  {contacts.length > 5 && (
                    <tr className="border-t border-[#e0e0e0]">
                      <td
                        colSpan={3}
                        className="px-3 py-2 text-center text-[#6b6b6b]"
                      >
                        +{contacts.length - 5} more contacts
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
