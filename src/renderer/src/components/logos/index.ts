import type { SourceId } from '@shared/types'
import { ClaudeMark } from './ClaudeMark'
import { CodexMark } from './CodexMark'
import { CursorMark } from './CursorMark'
import { ManualMark } from './ManualMark'
import type { MarkProps } from './types'

export const SOURCE_MARKS: Record<SourceId, (props: MarkProps) => React.JSX.Element> = {
  'claude-code': ClaudeMark,
  codex: CodexMark,
  cursor: CursorMark,
  manual: ManualMark
}

export { ClaudeMark, CodexMark, CursorMark, ManualMark }
export type { MarkProps }
