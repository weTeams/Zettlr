/* global define CodeMirror */
/**
  * @ignore
  * BEGIN HEADER
  *
  * Contains:        Citation rendering Plugin
  * CVM-Role:        CodeMirror Plugin
  * Maintainer:      Hendrik Erz
  * License:         GNU GPL v3
  *
  * Description:     This plugin renders citations in the document
  *
  * END HEADER
  */

(function (mod) {
  if (typeof exports === 'object' && typeof module === 'object') { // CommonJS
    mod(require('codemirror/lib/codemirror'))
  } else if (typeof define === 'function' && define.amd) { // AMD
    define(['codemirror/lib/codemirror'], mod)
  } else { // Plain browser env
    mod(CodeMirror)
  }
})(function (CodeMirror) {
  'use strict'

  const ipcRenderer = window.ipc
  const extractCitations = require('@common/util/extract-citations').default

  /**
   * Renders Markdown citations in place
   *
   * @param   {CodeMirror.Editor}  cm  The CodeMirror instance
   */
  CodeMirror.commands.markdownRenderCitations = function (cm) {
    // We'll only render the viewport
    const viewport = cm.getViewport()
    for (let i = viewport.from; i < viewport.to; i++) {
      if (cm.getModeAt({ line: i, ch: 0 }).name !== 'markdown-zkn') continue

      // First get the line and test if the contents contain a link
      const line = cm.getLine(i)
      const citations = extractCitations(line)

      for (const citation of citations) {
        if (citation.citations.length === 0) {
          continue // The module could not find any valid citations
        }

        const curFrom = { line: i, ch: citation.from }
        const curTo = { line: i, ch: citation.to }

        const cursorPosition = cm.getCursor('from')
        if (cursorPosition.line === curFrom.line && cursorPosition.ch >= curFrom.ch && cursorPosition.ch <= curTo.ch) {
          // Cursor is in selection: Do not render.
          continue
        }

        // We can only have one marker at any given position at any given time
        if (cm.doc.findMarks(curFrom, curTo).length > 0) {
          continue
        }

        // Do not render if it's inside a comment (in this case the mode will be
        // markdown, but comments shouldn't be included in rendering)
        // Final check to avoid it for as long as possible, as getTokenAt takes
        // considerable time.
        let tokenTypeBegin = cm.getTokenTypeAt(curFrom)
        let tokenTypeEnd = cm.getTokenTypeAt(curTo)
        if ((tokenTypeBegin && tokenTypeBegin.includes('comment')) ||
        (tokenTypeEnd && tokenTypeEnd.includes('comment'))) {
          continue
        }

        // A final check, as there is an edge case where if people use [[]] as
        // their internal links, and decide to use @-characters somewhere in
        // there, this plugin will attempt to render this as a citation as well
        // Hence: The citation shall not be encapsulated in square brackets.
        // See https://github.com/Zettlr/Zettlr/issues/1046
        if (line.substr(curFrom.ch - 1, 2) === '[[' && line.substr(curTo.ch - 1, 2) === ']]') {
          continue
        }

        // If we're at this point, we can actually render something!
        const span = document.createElement('span')
        span.className = 'citeproc-citation'
        const key = citation.citations.map(elem => elem.id).join(',')
        span.dataset.citekeys = key // data-citekeys="key1,key2"; necessary for the context menu
        span.textContent = line.substr(citation.from, citation.to - citation.from)
        // Apply TextMarker
        const textMarker = cm.markText(
          curFrom, curTo,
          {
            clearOnEnter: true,
            replacedWith: span,
            inclusiveLeft: false,
            inclusiveRight: false
          }
        )

        span.onclick = (e) => {
          textMarker.clear()
          cm.setCursor(cm.coordsChar({ left: e.clientX, top: e.clientY }))
          cm.focus()
        }

        // Now that everything is done, request the citation and replace the
        // text contents accordingly

        ipcRenderer.invoke('citeproc-provider', {
          command: 'get-citation',
          payload: { citations: citation.citations, composite: citation.composite }
        })
          .then((payload) => {
            if (payload !== undefined) {
              // We need to set the HTML as citeproc may spit out <i>-tags etc.
              span.innerHTML = payload
              textMarker.changed()
            } else {
              span.classList.add('error')
            }
          })
          .catch(e => console.error(e))
      }
    }
  }
})
