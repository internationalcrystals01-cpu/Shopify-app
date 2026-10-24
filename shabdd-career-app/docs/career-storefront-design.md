# Career storefront design

Banner image: `extensions/careers-theme/assets/career-gemstone-hero.png`.
Generated with the built-in image generation tool.

Prompt:
> Use case: photorealistic-natural. Generate a wide website hero banner background, 3:1 panoramic composition, for a luxury natural gemstone jewelry careers page. Warm ivory jewelry artisan studio. Right half: close-up of artisan's hands in dark forest green shirt, holding a faceted emerald in metal gem tweezers above a warm beige workbench. Loose ruby, sapphire, emerald, yellow sapphire gems along bottom right, jeweler loupe and delicate jewelry, softly blurred green plants behind. Left 55 percent is empty softly lit warm cream ivory wall and softly blurred tabletop negative space for a heading to be added in HTML. Premium editorial natural photography, realistic hands and tools, warm daylight, subtle depth of field. No text, no typography, no logos, no watermark. Save a project-ready image file and report its local output path.

After deploying the careers-theme app extension, open Shopify > Online Store > Themes > Customize, select the page containing Career Job List, and select that app block. Edit Banner image, Banner eyebrow, Banner heading, Banner description, and the three benefit headings/descriptions there. Banner text is HTML and is not embedded in the generated image. Existing saved heading/description settings continue to take precedence over defaults.

The store's existing theme header is managed by the theme. Jobs and filter options continue to use the existing app proxy endpoints. No job records or backend routes were changed.

Validation: production build passed; Shopify validator passed for the block, icon snippet and stylesheet using locally cached Liquid docs. Live browser review and deployment were not completed in this session.
