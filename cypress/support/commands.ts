
Cypress.Commands.add("getFramesFromFile", (path: string) => {
  cy.fixture(path, 'base64').then(Cypress.Blob.base64StringToBlob).then(async blob => {
    return new Int16Array(await blob.arrayBuffer());
  });
});
