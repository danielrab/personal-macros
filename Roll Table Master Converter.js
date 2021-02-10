/*
  quickDialog
    Send an array of data to build a Vertical Input Dialog of Multiple Types
    returns a promise (value is an Array of the chosen values)
  data = [{}]
  {} = {
    type : `type of input`, //text, password, radio, checkbox, number, select
    label : `Whatever you want to be listed`,
    options : [``] or ``
  }
*/
async function quickDialog({data, title = `Quick Dialog`} = {})
{
  data = data instanceof Array ? data : [data];
  return await new Promise((resolve) => {
    let content = `
    <table style="width:100%">
      ${data.map(({type, label, options}, i)=> {
        if(type.toLowerCase() === `select`)
        {
          return `<tr><th style="width:50%"><label>${label}</label></th><td style="width:50%"><select id="${i}qd">${options.map((e,i)=> `<option value="${e}">${e}</option>`).join(``)}</td></tr>`;
        }else if(type.toLowerCase() === `checkbox`){
          return `<tr><th style="width:50%"><label>${label}</label></th><td style="width:50%"><input type="${type}" id="${i}qd" ${options || ``}/></td></tr>`;
        }else if(type.toLowerCase() === `text`){
          return `<tr><th style="width:50%"><label>${label}</label></th><td style="width:50%"><textArea type="${type}" id="${i}qd" value="${options instanceof Array ? options[0] : options}"></textArea></td></tr>`;
        }else{
          return `<tr><th style="width:50%"><label>${label}</label></th><td style="width:50%"><input type="${type}" id="${i}qd" value="${options instanceof Array ? options[0] : options}"/></td></tr>`;
        }
      }).join(``)}
    </table>`;

    new Dialog({
      title, content,
      buttons : {
        Ok : { label : `Ok`, callback : (html) => {
          resolve(Array(data.length).fill().map((e,i)=>{
            let {type} = data[i];
            if(type.toLowerCase() === `select`)
            {
              return html.find(`select#${i}qd`).val();
            }else{
              switch(type.toLowerCase())
              {
                case `text` :
                  return html.find(`textArea#${i}qd`)[0].value;
                case `password` :
                case `radio` :
                  return html.find(`input#${i}qd`)[0].value;
                case `checkbox` :
                  return html.find(`input#${i}qd`)[0].checked;
                case `number` :
                  return html.find(`input#${i}qd`)[0].valueAsNumber;
              }
            }
          }));
        }}
      }
    }).render(true);
  });
}

function encloseInDiv(text) {
  return text? `<div class="deadlands-core">${text}</div>`: '';
}

function encloseInP(text) {
  if (!text) return '';
  return text.match(/^<.*>$/)? text: `<p>${text}</p>`
}

function boldifyTitle(text) {
  if (!text) return '';
  let match = text.match(/^(?<title>.*?): (?<description>.*)$/);
  if (!match) return text;
  let {title, description} = match.groups
  return `<strong>${title}</strong>: ${description}`;
}

function getRange(text) {
  let split = text.split('–');
  let [min, max] = split.length > 1? split: [text, text];
  return [Number(min), Number(max)];
}

function htmliseParagraphs(text) {
  let split = text.split('\n');
  return split.length > 1? split.map(s => s.trim()).map(encloseInP).join(''): text
}

async function main() {
  let [tableName, tableString, boldifyResultTitles, tableDescription, clubsDescription, diamondsDescription, heartsDescription, spadesDescription, bolfySuitDescriptions] = await quickDialog({data: [
    {type: 'text', label: 'table title', options: ''},
    {type: 'text', label: 'table copy', options: ''},
    {type: 'checkbox', label: 'boldify results titles', options: ''},
    {type: 'text', label: 'description (optional)', options: ''},
    {type: 'text', label: 'clubs description (if any)', options: ''},
    {type: 'text', label: 'diamonds description (if any)', options: ''},
    {type: 'text', label: 'hearts description (if any)', options: ''},
    {type: 'text', label: 'spades description (if any)', options: ''},
    {type: 'checkbox', label: 'boldify suits titles', options: ''},
  ], title: 'table config'});
  let values = {
    Two: '2',
    Three: '3',
    Four: '4',
    Five: '5',
    Six: '6',
    Seven: '7',
    Eight: '8',
    Nine: '9',
    Ten: '10',
    Jack: 'jack',
    Queen: 'queen',
    King: 'king',
    Ace: 'ace'
  };
  let suits = {
    clubs: bolfySuitDescriptions? htmliseParagraphs(boldifyTitle(clubsDescription.trim())): htmliseParagraphs(clubsDescription.trim()),
    diamonds: bolfySuitDescriptions? htmliseParagraphs(boldifyTitle(diamondsDescription.trim())): htmliseParagraphs(diamondsDescription.trim()),
    hearts: bolfySuitDescriptions? htmliseParagraphs(boldifyTitle(heartsDescription.trim())): htmliseParagraphs(heartsDescription.trim()),
    spades: bolfySuitDescriptions? htmliseParagraphs(boldifyTitle(spadesDescription.trim())): htmliseParagraphs(spadesDescription.trim()),
  };
  let table = tableString.trim().split('\n').map(row => row.split('	').map(s => s.trim())); // the symbol in the second split is a tab
  let cardsMode = table[0][0] === 'Card';
  let formula = cardsMode? '1d54': table[0][0];
  for (let collumn = 1; collumn < table[0].length; collumn += 1) {
    let results = [];
    let name = table[0].length > 2? `${tableName} - ${table[0][collumn]}`: tableName;
    let tableData = {
      name: name? name: 'New Table',
      formula,
      results,
      description: encloseInDiv(htmliseParagraphs(tableDescription.trim())),
      img: cardsMode? 'systems/swade/assets/ui/wildcard.svg': '',
    };
    let i = 0;
    for (let row = 1; row < table.length; row += 1) {
      let resultDescription = boldifyResultTitles? boldifyTitle(table[row][collumn]): table[row][collumn];
      resultDescription = htmliseParagraphs(resultDescription);
      if (cardsMode) {
        let valueRaw = table[row][0];
        if (Object.keys(values).includes(valueRaw)) {
          let value = values[valueRaw];
          for (let suit of Object.keys(suits)) {
            i += 1;
            results.push({text: encloseInDiv(encloseInP(resultDescription)+encloseInP(suits[suit])), range: [i, i], img: `systems/swade/assets/pokerDeck/${value}_of_${suit}.svg`})
          }
        } else {
          i += 1;
          results.push({text: encloseInDiv(resultDescription), range: [i, i], img: `systems/swade/assets/pokerDeck/${valueRaw.toLowerCase().replace(' ', '_')}.svg`})
        }
      } else {
        results.push({text: encloseInDiv(resultDescription), range: getRange(table[row][0])})
      }
    }
    RollTable.create(tableData);
  }
}
main();