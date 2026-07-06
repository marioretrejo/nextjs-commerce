import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";

export function DangerTab({ onOpenDelete }: { onOpenDelete: () => void }) {
  return (
    <TabsContent value="danger">
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-red-200 p-4">
            <p className="text-sm font-medium text-[#0a0a0a] mb-1">
              Delete Account
            </p>
            <p className="text-xs text-[#6b6b6b] mb-3">
              Permanently delete your account, all workspaces, agents,
              campaigns, and calls. This cannot be undone.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={onOpenDelete}
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
