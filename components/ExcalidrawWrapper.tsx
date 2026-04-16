"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawImperativeAPI = any;

interface Props {
  excalidrawAPI?: (api: ExcalidrawImperativeAPI) => void;
}

export function ExcalidrawWrapper({ excalidrawAPI }: Props) {
  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={excalidrawAPI}
        theme="dark"
        UIOptions={{
          canvasActions: {
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: false,
          },
        }}
      />
    </div>
  );
}
