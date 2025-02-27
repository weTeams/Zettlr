/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        CodeMirror task item classes hook
 * CVM-Role:        CodeMirror plugin
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     Adds "task-item-done" classes to done task items.
 *
 * END HEADER
 */

/**
 * Hooks onto the cursorActivity event to apply the classes
 *
 * @param   {CodeMirror}  cm  The instance
 */
module.exports = (cm) => {
  cm.on('changes', applyTaskItemClasses)
  cm.on('cursorActivity', applyTaskItemClasses)
}

function applyTaskItemClasses (cm) {
  let needsRefresh = false // Will be set to true if at least one line has been altered
  const itemClass = 'task-item-done'

  // This matches a line that starts with at most three spaces, followed by at
  // least three backticks or tildes (fenced code block).
  const taskItemRE = /^\s*[-+*]\s\[x\]\s/i

  for (let i = 0; i < cm.lineCount(); i++) {
    // First, get the line and the info whether it's currently a code block line
    const info = cm.lineInfo(i)
    const line = info.text
    const wrapClass = (info.wrapClass !== undefined) ? String(info.wrapClass) : ''
    const classIsApplied = wrapClass.includes(itemClass)
    const isDone = taskItemRE.test(line)

    if (isDone && !classIsApplied) {
      // We should render as code
      cm.addLineClass(i, 'wrap', itemClass)
      needsRefresh = true
    } else if (!isDone && classIsApplied) {
      // We should not render as code
      cm.removeLineClass(i, 'wrap', itemClass)
      needsRefresh = true
    } // Else: Leave the line as it is
  }

  // If at least one line was altered, we need a refresh
  if (needsRefresh) {
    cm.refresh()
  }
}
