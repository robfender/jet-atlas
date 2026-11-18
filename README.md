# Jet Atlas

**Black hole low Eddington / hard state jets across the mass scale**

An interactive comparison of observed black-hole outflows, curated by Rob Fender.

**Website:** https://robfender.github.io/jet-atlas/

Five initial sources: Swift J1727.8−1613, Cygnus X-1, NGC 6251, Centaurus A and M87. Select and reorder sources, set either end of the shared gravitational-radius range, fit images, switch projection and theme, toggle magnified insets and source information, share a view, and export self-contained SVG or PNG figures.

## Run locally

No installation or build is required. With Python 3 available:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765. ES modules and the catalogue require an HTTP server; opening index.html directly from the filesystem is insufficient.

Run calibration, range and share-link checks with Node 18 or later:

```sh
npm test
```

## Add a source

1. Prepare a scientifically calibrated, vertically aligned transparent PNG in `assets/`. Do not stretch its two axes differently. Record the approximate radio nucleus in the final PNG's pixel coordinates. PNG colours are illustrative. Existing assets store display brightness as alpha, preserving the dark-background image while allowing light backgrounds.
2. Add a record to the `sources` array in `sources.json`. Every existing record is a complete example. Required fields include `id`, `name`, `shortName`, `kind`, `band`, `color`, `lightColor`, `image`, `width`, `height`, `core: [x, y]`, `mass`, `massLabel`, `distance`, `inclination`, `inclinationLabel`, `eddington`, `rgPerPixelProjected`, `notes`, `calibration`, and `references: [{label, url}]`. All IDs must be unique and image paths relative. Labels are plain text, not HTML. An optional `inset` number sets a preferred magnification, automatically reduced if needed to fit its box.
3. `rgPerPixelProjected` must be the **projected** length of one pixel in units of GM/c². For angular pixel size θ in radians and distance D in the same units as GM/c²: `θ D / (GM/c²)`. For an already rotated isotropic image the angular scale is unchanged. For a printed physical bar, divide its length by its pixel length and by GM/c². Do not pre-apply an inclination correction here.
4. Set `inclination` to the adopted angle in degrees to the line of sight, or `null` when deprojection is unsupported. The deprojected view multiplies the whole image magnification by `1/sin(i)` once. This comparison is an isotropically magnified illustration, not a reconstruction of intrinsic transverse widths. M87's halo uses `null` in particular.
5. Check the image's resolution, core, angular/physical bar, adopted mass, distance, angle, displayed component, references and brightness threshold. Update `PROVENANCE.txt`. Source metadata remain fixed on the public site; changing assumptions is a curatorial code/data update.
6. Run `npm test`, inspect both themes and distance conventions, and export a figure. Commit and push. The new record appears in the selector automatically. To include it in the initial selected set, add its ID to both arrays in `DEFAULTS` in `model.js`.

## Scientific conventions

- R_G = GM/c², not 2GM/c².
- All radio nuclei align to one horizontal core line. Principal outflow directions are vertical; sky north is not uniform.
- Common physical magnification is preserved across columns. Images that exceed a column's visible bounds are clipped and labelled; they are never silently shrunk to fit. Fit accounts for both vertical extent and available column width.
- M87's full 327-MHz halo remains **projected** in both modes. The inner jet's 17.2° inclination does not establish an outer-halo inclination.
- The other inclinations are explicitly adopted values. Mass and distance uncertainties are not propagated in this first release.
- Colours are illustrative. Resolution, sensitivity, brightness scaling and observed outflow components differ across observations. No brightness comparison is implied.
- Eddington ratios are approximate nuclear radiative Lbol/LEdd. J1727's ~1 is the peak hard-state value, not necessarily the imaging epoch.
- The NGC 6251 image retains the approximate historical printed 100-kpc calibration. Its original assumed distance is not independently recovered.
- Cygnus X-1 uses the native isotropic 2016 VLBA FITS stack, rather than the anisotropically stretched panels used to illustrate bending in the paper.

## Deployment

This repository is a static GitHub Pages site. Publish the `main` branch, root folder `/`, under Settings → Pages. The `.nojekyll` file bypasses Jekyll; no external libraries, database, accounts, API keys, analytics or backend are needed. Subsequent pushes publish updates automatically.

`app.js` handles the interface and SVG figure; `model.js` holds pure calibration/range/link functions; `sources.json` is the source catalogue; `assets/geometry.json` is the initial asset-generation audit (the live site uses only `sources.json`); `styles.css` is the responsive layout. Exported SVGs embed the images, settings, source metadata and originating comparison URL.

## Credits and reuse

Scientific images and observations are credited to their original authors in the source cards and `PROVENANCE.txt`; underlying image rights remain with their respective rights holders. The interface does not imply endorsement by those authors. Do not treat the repository as relicensing third-party scientific imagery.

Suggestions: Rob.Fender@physics.ox.ac.uk. Please include the source name, paper and a calibrated image or public data link.

## Physical size mode

The size switch compares either R_G (the default, plotted in billions) or actual physical distance in parsecs. The conversion is per source: projected pc/pixel = projected R_G/pixel × (4.785560552051379e-14 pc/Msun) × mass/Msun. Inclination corrections remain an independent choice, applied exactly once in either mode. M87 halo remains projected.

Switching units auto-fits the selected sources. Physical mode initially disables insets to show the size contrast directly. A source less than one figure pixel tall is represented by a labelled core marker; the marker radius is an annotation and not the emission extent. Re-enabling insets provides explicitly magnified images with their own pc/kpc/AU bars. Share URLs, range validation and SVG/PNG exports carry the unit mode; old URLs without a units parameter retain the original R_G interpretation.

Insets occupy unused space above or below each source within the main plotting range. Their height and magnification adapt to available space without covering the true-scale image. When no clear space is available, an inset is omitted. Figure height no longer grows to accommodate a separate inset row.

## Additional source views (November 2026)

The catalogue now has eight views of seven objects. The existing NGC 6251 image is labelled **NGC 6251 (jet)**. **NGC (lobes)** is a separate full LOFAR150MHz jet/lobe image from Cantwell et al.2020, sharing the same mass and objectId but retained projected because the outer-lobe angle is unknown. **1E 1740.7−2942** is the April1992 VLA contour panel reprocessed by Luque-Escamilla et al.2015, with Mirabel et al.1992 credited for discovery. It uses adopted D8.5kpc and M10Msun, not dynamically measured parameters, and remains projected in both size modes. Its displayed contour structure is approximately2.8pc end to end at that distance.

The existing five-view default selection is retained; the two added views are available in the selector. Select all and Fit selected sources to see their full extents together. Old shared URLs keep their selections. Tiny views may receive larger, explicitly labelled insets so they remain informative when the parsec-scale microquasar dominates the R_G range. More than five selected views scroll horizontally to preserve readable labels. The optional objectId field counts multiple component images of the same black hole only once in the introduction.

## Alcyoneus and zoom controls

Alcyoneus uses Oei et al.2022 Fig.1’s original radio/WISE composite, isolating the orange radio emission, retaining the two lobes and central jets, and recolouring it silver. The caption gives an exact2048-arcsec square field on a2048-pixel image, hence1arcsec/pixel. The paper uses4.0kpc/arcsec; M=(3.9+/-1.7)e8Msun is a velocity-dispersion-based estimate. No lobe deprojection is applied. The approximate radiativeEddingtonratio is a jet-mode inference, not a direct bolometric measurement. Full calibration/selection information is in assets/alcyoneus_geometry.json.

**Zoom uses the − and + buttons by default.** Scroll to zoom is off on new visits, old share URLs without the scroll parameter and Reset. Visitors may enable it under Display. The state is included in shared URLs and exported metadata. Mouse-wheel input passes through for normal page scrolling while it is off. Both controls use the same bounded range transformation, centred on the nucleus line; − widens the range by25%, + narrows it by20%.
