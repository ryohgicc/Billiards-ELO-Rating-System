import { Suspense } from "react";

import { PlayerPreviewView } from "@/components/player-preview-view";

export default function PreviewPage() {
  return (
    <Suspense fallback={<section className="panel">正在读取球员预览数据...</section>}>
      <PlayerPreviewView />
    </Suspense>
  );
}
