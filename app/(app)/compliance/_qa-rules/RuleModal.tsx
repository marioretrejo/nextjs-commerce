import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck } from "lucide-react";
import type { ComplianceRule, RuleForm } from "./config";

export function RuleModal({
  open,
  onClose,
  editing,
  form,
  setForm,
  saving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  editing: ComplianceRule | null;
  form: RuleForm;
  setForm: Dispatch<SetStateAction<RuleForm>>;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            {editing ? "Edit Compliance Rule" : "New Compliance Rule"}
          </DialogTitle>
          <DialogDescription>
            Define what the agent must say, avoid, or be evaluated on during
            calls.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Rule Name</Label>
            <Input
              placeholder="e.g. Investment Risk Disclosure"
              value={form.rule_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, rule_name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Description{" "}
              <span className="text-[#a0a0a0] text-xs">
                (what the evaluator checks)
              </span>
            </Label>
            <Textarea
              rows={3}
              placeholder="e.g. The agent must mention that investments carry risk and past performance does not guarantee future results."
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v as typeof f.category }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disclosure">Disclosure</SelectItem>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="prohibited">Prohibited</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select
                value={form.severity}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, severity: v as typeof f.severity }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? "Saving…" : editing ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
