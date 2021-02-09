function error(text) {
  return ui.notifications.error(text);
}
function replaceAll(s, original, replacement) {
  let res = s;
  let iter = res.replace(original, replacement);
  while (res !== iter) {
    res = iter;
    iter = res.replace(original, replacement);
  }
  return res;
}
function findFirstDiffPos(a, b, startA = 0, startB = 0)
{
  let aSlice = a.slice(startA)
  let bSlice = b.slice(startB)
  let shorterLength = Math.min(aSlice.length, bSlice.length);
  for (let i = 0; i < shorterLength; i++)
  {
      if (aSlice[i] !== bSlice[i]) return i;
  }
  if (aSlice.length !== bSlice.length) return shorterLength;
  return -1;
}
function _replaceTextContent(text, rgx, func) {
  let replaced = false;
  for ( let t of text ) {
    const matches = t.textContent.matchAll(rgx);
    for ( let match of Array.from(matches).reverse() ) {
      const replacement = func(...match);
      if ( replacement ) {
      let matched_text = match[0];
      let div = document.createElement("div");
      div.innerHTML = '__start_replacement__' + '__replacement_start_flag__' + replacement.outerHTML + '__replacement_mid_flag__' + matched_text + '__replacement_end_flag__' + '__end_replacement__';
        TextEditor._replaceTextNode(t, match, div);
        replaced = true;
      }
    }
  }
  return replaced;
}
function enrichHTML(content, {secrets=false, entities=true, links=true, rolls=true, rollData=null}={}) {
  // Create the HTML element
  const html = document.createElement("div");
  html.innerHTML = String(content);
  // Remove secret blocks
  if ( !secrets ) {
    let elements = html.querySelectorAll("section.secret");
    elements.forEach(e => e.parentNode.removeChild(e));
  }
  // Plan text content replacements
  let updateTextArray = true;
  let text = [];
  // Replace entity links
  if ( entities ) {
    if ( updateTextArray ) text = TextEditor._getTextNodes(html);
    const entityTypes = CONST.ENTITY_LINK_TYPES.concat("Compendium");
    const rgx = new RegExp(`@(${entityTypes.join("|")})\\[([^\\]]+)\\](?:{([^}]+)})?`, 'g');
    updateTextArray = _replaceTextContent(text, rgx, TextEditor._createEntityLink);
  }
  // Replace hyperlinks
  if ( links ) {
    if ( updateTextArray ) text = TextEditor._getTextNodes(html);
    const rgx = /(https?:\/\/)(www\.)?([^\s<]+)/gi;
    updateTextArray = _replaceTextContent(text, rgx, TextEditor._createHyperlink);
  }
  // Replace inline rolls
  if ( rolls ) {
    if (updateTextArray) text = TextEditor._getTextNodes(html);
    const rgx = /\[\[(\/[a-zA-Z]+\s)?(.*?)([\]]{2,3})/gi;
    updateTextArray = _replaceTextContent(text, rgx, (...args) => TextEditor._createInlineRoll(...args, rollData));
  }
  // Return the enriched HTML
  return html.innerHTML;
}
function processHTML(html) {
  let precessedHTML = enrichHTML(html);
  precessedHTML = replaceAll(precessedHTML, '<div>__start_replacement__', '')
  precessedHTML = replaceAll(precessedHTML, '__end_replacement__</div>', '')
  return precessedHTML;
}
function getReplacements(rawHTML) {
  const replacementRegex = /__replacement_start_flag__(?<pretty>.+?)__replacement_mid_flag__(?<raw>.+?)__replacement_end_flag__/g
  let processedHTML = processHTML(rawHTML);
  return [...processedHTML.matchAll(replacementRegex)].map(m => m.groups);
}
function deprettify(prettyHTML, replacements) {
  let res = prettyHTML;
  for (let replacement of replacements) {
    res = res.replace(replacement.pretty, replacement.raw)
  }
  return res;
}
function getJournalEntry(node, maxDepth=20) {
  if (maxDepth < 0) return null;
  if (node.getAttribute && node.getAttribute('id')) {
    let journalRawID = node.getAttribute('id');
    let journalIDRegex = /journal-(?<id>\w*)/;
    let JournalID = journalRawID.match(journalIDRegex).groups.id;
    return game.journal.get(JournalID);
  }
  if (!node.parentNode) return null;
  return getJournalEntry(node.parentNode, maxDepth-1)
}
function getJournalFrame(node, maxDepth=20) {
  if (maxDepth < 0) return null;
  if (node.className === "editor-content") return node;
  if (!node.parentNode) return null;
  return getJournalFrame(node.parentNode, maxDepth-1)
}
async function replaceSelection(selection, text) {
  let journalEntry = getJournalEntry(selection.baseNode);
  let journalFrame = getJournalFrame(selection.baseNode);
  if (!journalEntry) return error("failed to get journal entry");
  if (!journalFrame) return error("failed to get journal frame");
  let rawHTML = journalEntry.data.content;
  let replacements = getReplacements(rawHTML);
  let selectionRange = selection.getRangeAt(0);
  selectionRange.deleteContents();
  selectionRange.insertNode(document.createTextNode(text));
  let deprettifiedHTML = deprettify(journalFrame.innerHTML, replacements);
  await journalEntry.update({content: deprettifiedHTML});
}
async function main(){
  let selection = window.getSelection();
  let startNode = selection.baseNode;
  if (!(startNode.nodeType === 3)) return error("startNode isn't text");
  let endNode = selection.focusNode;
  if (!(startNode.nodeType === 3)) return error("endNode isn't text");
  if (!(startNode.parentNode === endNode.parentNode))
    return error("startNode and endNode have different parents");
  await replaceSelection(selection, selection.toString())
}
main()