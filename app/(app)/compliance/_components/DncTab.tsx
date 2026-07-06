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
import type { DncEntry } from "@/lib/supabase/types";

export function DncTab({
  dncEntries,
  filteredDnc,
  newPhone,
  setNewPhone,
  newReason,
  setNewReason,
  addingPhone,
  onAdd,
  onRemove,
  bulkInput,
  setBulkInput,
  bulkImporting,
  onBulkImport,
  dncSearch,
  setDncSearch,
}: {
  dncEntries: DncEntry[];
  filteredDnc: DncEntry[];
  newPhone: string;
  setNewPhone: (v: string) => void;
  newReason: string;
  setNewReason: (v: string) => void;
  addingPhone: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  bulkInput: string;
  setBulkInput: (v: string) => void;
  bulkImporting: boolean;
  onBulkImport: () => void;
  dncSearch: string;
  setDncSearch: (v: string) => void;
}) {
  return (
    <TabsContent value="dnc" className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Add Number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Phone Number</Label>
              <Input
                placeholder="+1 (555) 000-0000"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAdd()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input
                placeholder="e.g. Customer request, Legal opt-out"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
              />
            </div>
            <Button
              onClick={onAdd}
              disabled={addingPhone}
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" /> Add to DNC List
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bulk Import</CardTitle>
            <CardDescription>One phone number per line</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder={"+1234567890\n+0987654321\n+1122334455"}
              rows={4}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
            />
            <Button
              onClick={onBulkImport}
              disabled={bulkImporting}
              size="sm"
              variant="outline"
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-1" />{" "}
              {bulkImporting ? "Importing…" : "Import Numbers"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>DNC Registry</CardTitle>
            <CardDescription>
              {dncEntries.length} numbers blocked
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Search…"
              value={dncSearch}
              onChange={(e) => setDncSearch(e.target.value)}
              className="w-48 h-8 text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const csv =
                  "phone,reason,added_at\n" +
                  dncEntries
                    .map((e) => `${e.phone},${e.reason ?? ""},${e.added_at}`)
                    .join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "dnc-list.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredDnc.length === 0 ? (
            <div className="py-12 text-center">
              <PhoneOff className="h-8 w-8 text-[#e0e0e0] mx-auto mb-2" />
              <p className="text-sm text-[#6b6b6b]">
                {dncSearch
                  ? "No matching numbers"
                  : "No numbers in DNC list yet"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#e0e0e0]">
              {filteredDnc.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-6 py-3"
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
                    <span className="text-xs text-[#6b6b6b]">
                      {format(new Date(entry.added_at), "MMM d, yyyy")}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#6b6b6b]" />
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
