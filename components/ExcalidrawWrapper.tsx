'use client'

import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawImperativeAPI = any

interface Props {
  excalidrawAPI?: (api: ExcalidrawImperativeAPI) => void
}

export function ExcalidrawWrapper({ excalidrawAPI }: Props) {
  return (
    <div className='absolute inset-0'>
      <Excalidraw
        excalidrawAPI={excalidrawAPI}
        theme='light'
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
  )
}
