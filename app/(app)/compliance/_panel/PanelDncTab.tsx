import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import { PhoneOff, Trash2, Plus, Upload, Download } from "lucide-react";
import { format } from "date-fns";
import type { useCompliance } from "../_components/useCompliance";

export function PanelDncTab({ c }: { c: ReturnType<typeof useCompliance> }) {
  return (
    <TabsContent value="dnc" className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Add Number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input
                placeholder="+1 (555) 000-0000"
                value={c.newPhone}
                onChange={(e) => c.setNewPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && c.addDncEntry()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input
                placeholder="e.g. Customer request"
                value={c.newReason}
                onChange={(e) => c.setNewReason(e.target.value)}
              />
            </div>
            <Button
              onClick={c.addDncEntry}
              disabled={c.addingPhone}
              size="sm"
              className="w-full gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add to DNC List
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Bulk Import</CardTitle>
            <CardDescription>One phone number per line</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder={"+1234567890\n+0987654321"}
              rows={4}
              value={c.bulkInput}
              onChange={(e) => c.setBulkInput(e.target.value)}
            />
            <Button
              onClick={c.bulkImport}
              disabled={c.bulkImporting}
              size="sm"
              variant="outline"
              className="w-full gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              {c.bulkImporting ? "Importing…" : "Import Numbers"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-sm">DNC Registry</CardTitle>
            <CardDescription>
              {c.dncEntries.length} numbers blocked
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Search…"
              value={c.dncSearch}
              onChange={(e) => c.setDncSearch(e.target.value)}
              className="w-40 h-8 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const csv =
                  "phone,reason,added_at\n" +
                  c.dncEntries
                    .map((e) => `${e.phone},${e.reason ?? ""},${e.added_at}`)
                    .join("\n");
                const url = URL.createObjectURL(
                  new Blob([csv], { type: "text/csv" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "dnc-list.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {c.filteredDnc.length === 0 ? (
            <div className="py-12 text-center">
              <PhoneOff className="h-8 w-8 text-[#e0e0e0] mx-auto mb-2" />
              <p className="text-sm text-[#6b6b6b]">
                {c.dncSearch
                  ? "No matching numbers"
                  : "No numbers in DNC list yet"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#f0f0f0]">
              {c.filteredDnc.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium font-mono">
                      {entry.phone}
                    </p>
                    {entry.reason && (
                      <p className="text-xs text-[#6b6b6b]">{entry.reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-[#9b9b9b]">
                      {format(new Date(entry.added_at), "MMM d, yyyy")}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => c.removeDncEntry(entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#9b9b9b]" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
