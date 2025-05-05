/// <reference types="cypress" />



describe('test login and websitedetails ', () => {
  beforeEach(() => {

    cy.visit('http://localhost:5173')
  })

  it('logs in to the dashboard', () => {
    cy.get('#email').type('simon3@simon.no')
    cy.get('#password').type('simon1')
    cy.get('.css-14zvv3q-MuiGrid2-root > .MuiButtonBase-root').click()
  })

  it('clicks card on dashboard', () => {
    cy.get('#email').type('simon3@simon.no')
    cy.get('#password').type('simon1')
    cy.get('.css-14zvv3q-MuiGrid2-root > .MuiButtonBase-root').click()
    cy.wait(10000)
    cy.get('#website-card-grid-53 > .MuiPaper-root > .MuiCardContent-root').click()
  })

  it('checks if websitedetails is rendered', () => {
    cy.get('#email').type('simon3@simon.no')
    cy.get('#password').type('simon1')
    cy.get('.css-14zvv3q-MuiGrid2-root > .MuiButtonBase-root').click()
    cy.wait(10000)
    cy.get('#website-card-grid-53 > .MuiPaper-root > .MuiCardContent-root').click()
    cy.get('.MuiPaper-elevation3')
  })

})


