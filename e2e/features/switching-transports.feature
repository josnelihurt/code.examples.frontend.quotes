Feature: Switching transports
  Every quote page offers the four transports serving the same use cases: v0 by MVC
  controllers, v1 by minimal APIs, v2 by the proto contract behind a wire-identical
  adapter, and v3 by stock gRPC-JSON transcoding. Each journey here runs whole on one
  transport — a random quote, the catalog and a publish — and every page reports who
  served it.

  Unlike browsing-quotes.feature these scenarios grow the catalog themselves, so they
  assert on content and the serving transport only, never on page counts.

  Background:
    Given I am on the sign-in page
    And I sign in as "jrb" with password "supersecret"

  Scenario: The v2 transport serves the whole journey
    When I switch the API version to "v2"
    And I fetch a random quote
    Then a quote is displayed
    And the quote was served by "v2"
    When I open the catalog
    Then the catalog lists the seeded quote by "Leonardo da Vinci"
    And the catalog was served by "v2"
    When I fill the publish form with unique text attributed to "Browser Suite"
    And I submit the publish form
    Then the published quote is confirmed
    And the published quote was served by "v2"

  Scenario: The v3 transport serves the whole journey
    When I switch the API version to "v3"
    And I fetch a random quote
    Then a quote is displayed
    And the quote was served by "v3"
    When I open the catalog
    Then the catalog lists the seeded quote by "Leonardo da Vinci"
    And the catalog was served by "v3"
    When I fill the publish form with unique text attributed to "Browser Suite"
    And I submit the publish form
    Then the published quote is confirmed
    And the published quote was served by "v3"
