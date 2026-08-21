const HF = require('../public/vendor/hyperformula.full.min.js');
const hf = (HF.default||HF).buildEmpty({licenseKey:'gpl-v3',language:'enGB'});

hf.addSheet('A'); hf.addSheet('B'); hf.addSheet('C');
console.log('before:', hf.getSheetNames(), 'ids:', hf.getSheetNames().map(n=>hf.getSheetId(n)));

hf.removeSheet(0);
console.log('remove A:', hf.getSheetNames(), 'ids:', hf.getSheetNames().map(n=>hf.getSheetId(n)));

hf.removeSheet(0);
console.log('remove B:', hf.getSheetNames(), 'ids:', hf.getSheetNames().map(n=>hf.getSheetId(n)));

hf.removeSheet(0);
console.log('remove C:', hf.getSheetNames());

// test setCellContents with getSheetId
hf.addSheet('D');
const id = hf.getSheetId('D');
hf.setCellContents({sheet:id,row:0,col:0}, [['42','=A1']]);
console.log('D A1:', hf.getCellValue({sheet:id,row:0,col:0}));
console.log('D B1:', hf.getCellValue({sheet:id,row:0,col:1}));
console.log('PASS');
