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
async function replaceSelection(selectionRange, journalEntry, journalFrame, text) {
  let rawHTML = journalEntry.data.content;
  let replacements = getReplacements(rawHTML);
  selectionRange.deleteContents();
  selectionRange.insertNode(document.createTextNode(text));
  let deprettifiedHTML = deprettify(journalFrame.innerHTML, replacements);
  await journalEntry.update({content: deprettifiedHTML});
}
async function getPacksContents() {
  let packRegex = /^(?<moduleName>[\w-]+)\.(?<packName>[\w-]+)$/;
  let packs = {}
  for (let pack of game.packs.entries){
    let {moduleName, packName} = pack.collection.match(packRegex).groups;
    if (!packs[moduleName]) packs[moduleName] = {};
    packs[moduleName][packName] = pack;
  }
  let packsContents = [];
  for (let moduleName of Object.keys(packs)) {
    for (let packName of Object.keys(packs[moduleName])) {
      let pack = packs[moduleName][packName];
      packsContents.push(...pack.index.filter(entry => entry.name !== '#[CF_tempEntity]').map(entry => ({name: entry.name, module: moduleName, pack: packName, type: pack.entity, id: entry._id})));
    }
  }
  return packsContents;
}
function levenshteinDistance(a, b) {
	let tmp;
	if (a.length === 0) { return b.length; }
	if (b.length === 0) { return a.length; }
	if (a.length < b.length) { tmp = a; a = b; b = tmp; }

	let i, j, res, alen = a.length, blen = b.length, row = Array(alen);
	for (i = 0; i <= alen; i++) { row[i] = i; }

	for (i = 1; i <= blen; i++) {
		res = i;
		for (j = 1; j <= alen; j++) {
			tmp = row[j - 1];
			row[j - 1] = res;
			res = b[i - 1] === a[j - 1] ? tmp : Math.min(tmp + 1, Math.min(res + 1, row[j] + 1));
		}
	}
	return res;
}
function cleanName(text) {
  return text.toLowerCase().match(/^(\d+ )?(?<core>.*?)( \(.+\))?$/).groups.core;
}
function sortPacks(packs, target) {
  return packs.map(pack => ({pack, distance: levenshteinDistance(cleanName(pack.name), (target))}))
    .sort((pd1, pd2) => pd1.distance - pd2.distance)
    .map(pd => pd.pack);
}
function getLink(entry, text) {
  return `@Compendium[${entry.module}.${entry.pack}.${entry.name}]{${text}}`
}
async function renderEntry(entry) {
  let pack = game.packs.get(`${entry.module}.${entry.pack}`);
  let entity = await pack.getEntity(entry.id);
  return entity.sheet.render(true)
}
function getButtons(packsContents, target, callback, startIndex = 0, count = 10) {
  let sortedContents = sortPacks(packsContents, target);
  let buttonsArray = [];
  let links = [];
  for (let i=startIndex; i < Math.min(startIndex + count, sortedContents.length); i += 1) {
    let entry = sortedContents[i];
    let buttonName = `${i - startIndex + 1}) ${entry.name} <br> module: ${entry.module} <br> pack: ${entry.pack}`;
    let buttonCallback = () => callback(entry);
    buttonsArray.push({buttonName, buttonCallback});
    links.push(TextEditor.enrichHTML(getLink(entry, i - startIndex + 1), {secrets:true}));
  }
  const buttons = {};
  buttonsArray.forEach((m) => {
    buttons[m.buttonName] = {
        label: m.buttonName,
        callback: m.buttonCallback
    }
  });
  return {buttons, links};
}
async function selectEntry(packsContents, initialTarget) {
  let target = initialTarget;
  let resolvePromise;
  let promise = new Promise((resove) => {resolvePromise = resove});
  let {buttons, links} = getButtons(packsContents, target, resolvePromise);
  console.log(links);
  let content = `
<style>
#macroSelector .dialog-buttons {
        flex-direction: column;
}
</style>
<table style="width:100%">
  <tr>
    ${links.map(link => `<th style="width:${100/links.length}%">${link}</th>`).join('')}
  </tr>
</table>`;
 let dialog = new Dialog({
    title: "Select entry",
    content: content,
    buttons: buttons
  }, {id: "macroSelector"});
  dialog.render(true);
  return promise;
}
async function input(prompt)
{
  let value = await new Promise((resolve)=>{
    new Dialog({
      title : `Input Dialog`, 
      content : `<table style="width:100%"><tr><th style="width:100%"><label>${prompt}</label></th></tr><tr><td style="width:100%"><input type="text" name="input"/></td></tr></table>`,
      buttons : {
        Ok : { label : `Ok`, callback : (html) => { resolve(html.find("input").val()); }}
      }
    }).render(true);
  });
  return value;
}
async function main(){
  let selection = window.getSelection();
  let startNode = selection.baseNode;
  if (!(startNode.nodeType === 3)) return error("startNode isn't text");
  let endNode = selection.focusNode;
  if (!(startNode.nodeType === 3)) return error("endNode isn't text");
  if (!(startNode.parentNode === endNode.parentNode))
    return error("startNode and endNode have different parents");
  let selectionText = selection.toString();
  let journalEntry = getJournalEntry(selection.baseNode);
  let journalFrame = getJournalFrame(selection.baseNode);
  if (!journalEntry) return error("failed to get journal entry");
  if (!journalFrame) return error("failed to get journal frame");
  let selectionRange = selection.getRangeAt(0);
  let packsContents = await getPacksContents();
  let term = await input('what term to search?');
  let entry = await selectEntry(packsContents, term);
  let link = getLink(entry, selectionText);
  replaceSelection(selectionRange, journalEntry, journalFrame, link);
  renderEntry(entry);
}
main();