
// const fhirpath = (context, lambda) => {
//     let expr = lambda(context);
// }

// fhirpath(($this)=>
//     $this.Patient.name.where(($this)=> fhirpath.equal($this.use ,'official')).given.first().substring(0, 1)
// )

const start = performance.now();
let context = [{resourceType: 'Patient', name: [{use: 'official', given: ['John', 'Doe']}]} ]
for(let i = 0; i < 10000000; i++) {
    let v1 = context.filter((item)=>item.resourceType === 'Patient');
    let v2 = v1.flatMap((item)=>item.name);
    let v3 = v2.filter((item)=>item.use === 'official');
    let v4 = v3.flatMap((item)=>item.given);
    let v5 = v4.slice(0, 1);
    let v6 = v5.map((item)=>item.substring(0, 1));
}
const end = performance.now();
console.log('v1', (10000/ (end - start)), 'Mops/s');


const start2 = performance.now();
let context2 = [{resourceType: 'Patient', name: [{use: 'official', given: ['John', 'Doe']}]} ]
for(let i = 0; i < 10000000; i++) {
    let v1 = []
    for(let item of context2) {
        if(item.resourceType === 'Patient') {
            v1.push(item);
        }
    }
    let v2 = []
    for(let item of v1) {
        v2.push(item.name);
    }
    let v3 = []
    for(let item of v2) {
        if(item.use === 'official') {
            v3.push(item);
        }
    }
    let v4 = []
    for(let item of v3) {
        v4.push(item.given);
    }
    let v5 = []
    for(let item of v4) {
        v5.push(item.slice(0, 1));
    }
    let v6 = []
    for(let item of v5) {
        v6.push(item.substring(0, 1));
    }
}
const end2   = performance.now();
console.log('v2', (10000/ (end2 - start2)), 'Mops/s');