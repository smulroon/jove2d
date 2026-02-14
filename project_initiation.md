# Goal
Create a new game engine for 2D games based on love2d. This engine will be JavaScript/TypeSript based and called jove2d.

## Subgoals
- clean modern API
- The API of jove2d should match the API of love2d as closely as possible
- Avoid any of the legacy issues that have accumulated in love over time
- the jove api should be accessible from javascript or typescript 

# Stack
- The technologies for building jove2d are SDL3 and Bun
- love2d will also be needed to run comparative tests
- git is used to track changes to the code
- download and install local copies of love2d and sdl3

# Methodology
- Set up the environment for typescript, bun, and sdl3
- commit changes
- start with the most basic feature (e.g. creating a window) and add fuctionality one feature at a time
- for each functionality
   - add the jove2d code for the feature
   - create a test for that code that takes a screenshot before exiting
   - create a test for the equivalent functionality in love2d  that takes a screenshot before exiting
   - compare the screenshots:
      - if they match the functionality has been successfully implemented
      - if not iterate on the jove2d implementation until they do
   - once a fuctionality has been successfully implemented, retest all previously created tests and ensure compatibility is being maintained
   - if all previous tests pass, or there are no previous tests, commit the changes and move on to the next functionality
   - if some tests fail, iterated on the jove2d implementation until they pass 


