# dev-T1-fix1 report (saved by the harbormaster from the agent's final message)

Committed as 7622a3e. In CrateBox.vue, onSleeveClick takes the click event and, for offset 0, returns early when the click's clientX/clientY fall inside the .panel.front bounding rect. A zero-size rect never counts, so happy-dom's all-zero rects still open the record. Test added: 'ignores a click on the current sleeve that lands inside the crate front'. npm test (328), typecheck, lint and format:check pass. The dev did not run the browser check.
