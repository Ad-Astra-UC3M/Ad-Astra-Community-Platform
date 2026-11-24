/** Comprueba que el corte del hero no deja una junta visible al cambiar de anchura. */
import { expect, test } from "@playwright/test";
import sharp from "sharp";

test("el fondo del hero continúa sin junta hasta la diagonal", async ({ page }, testInfo) => {
  const widths = testInfo.project.name === "desktop" ? [836, 1280] : [390];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const photo = page.getByRole("img", { name: "Estudiantes conversan con integrantes de Ad Astra en el campus" });
    await expect.poll(() => photo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    if (width < 768) continue;

    const box = await photo.boundingBox();
    expect(box).not.toBeNull();
    // Cruza la antigua junta vertical, lejos del texto y de la diagonal amarilla.
    const strip = await page.screenshot({ clip: {
      x: Math.floor(box!.x) - 4, y: Math.ceil(box!.y + box!.height * 0.25),
      width: 8, height: Math.floor(box!.height * 0.4),
    } });
    const { data, info } = await sharp(strip).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const background = [...data.subarray(0, info.channels)];
    for (let offset = 0; offset < data.length; offset += info.channels) {
      expect([...data.subarray(offset, offset + info.channels)], `junta a ${width}px, píxel ${offset / info.channels}`).toEqual(background);
    }
  }
});
