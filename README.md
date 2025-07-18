# @atomic-ehr/fhirpath

TypeScript implementation of FHIRPath.

```typescript
import { FHIRPathProvider } from '@atomic-ehr/fhirpath';

const system = AtomicSystem.create({
    terminology: ExternalTerminology({ url: "http://tx.fhir.org" }),
    registry: NPMRegistry({ packages: [ 'hl7.fhir.r4.core' ] }),
    fhirpath: FHIRPath({ })
});

const patient = {
    name: {
        given: ['John', 'Doe'],
    },
};

const result = system.fhirpath.evaluate('Patient.name.given', patient);
console.log(result);
// ['John', 'Doe']


```
