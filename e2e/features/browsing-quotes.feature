Feature: Browsing quotes
  A signed-in reader pages through the catalog in the browser. The catalog ships
  seeded, so there is always something to read, and both transports serve the same
  stable ordering.

  The page counts below assume the seeded catalog (8 quotes at 5 per page): this
  feature alphabetically precedes publishing-quotes.feature. Isolation is per mode —
  the full-stack suite shares one seeded database so it runs with a single worker;
  the mocked suite gives every scenario its own fresh catalog via its browser
  context. Either way, scenarios cannot grow the catalog mid-feature.

  Background:
    Given I am on the sign-in page
    And I sign in as "jrb" with password "supersecret"

  Scenario: The first page of the catalog lists seeded quotes
    When I open the catalog
    Then the catalog shows page 1 of 2
    And the catalog lists the seeded quote by "Leonardo da Vinci"

  Scenario: Paging moves through the catalog
    When I open the catalog
    Then the previous page control is disabled
    And I move to the next page
    Then the catalog shows page 2 of 2
    And the next page control is disabled
    And I move to the previous page
    Then the catalog shows page 1 of 2

  Scenario: The v0 transport serves the catalog
    When I open the catalog
    And I switch the API version to "v0"
    Then the catalog shows page 1 of 2
    And the catalog was served by "v0"
