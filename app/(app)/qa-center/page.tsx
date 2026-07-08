"use client";

import { useState } from "react";
import { QACenterLayout } from "./_components/v2/QACenterLayout";

export default function QACenterPage() {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  return (
    <QACenterLayout
      selectedCallId={selectedCallId}
      onSelectCall={setSelectedCallId}
    />
  );
}
