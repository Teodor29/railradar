// Size in CSS pixels. The train points north, MapLibre rotates it by bearing.
const WIDTH = 12
const HEIGHT = 24
const OUTLINE = 1.5

// SVG paths in a WIDTH × HEIGHT box. Can be replaced with paths exported from a design tool.
const BODY = new Path2D(
  "M2 24 L10 24 Q12 24 12 22 L12 9 C12 4 9 0 6 0 C3 0 0 4 0 9 L0 22 Q0 24 2 24 Z",
)
const WINDSHIELD = new Path2D("M2.2 8 C3.6 5.2 8.4 5.2 9.8 8 L9.4 9.2 C7.8 7.6 4.2 7.6 2.6 9.2 Z")

export function drawTrainIcon(fill: string, outline: string) {
  const pixelRatio = Math.max(2, Math.ceil(window.devicePixelRatio))
  const canvas = document.createElement("canvas")
  canvas.width = (WIDTH + OUTLINE * 2) * pixelRatio
  canvas.height = (HEIGHT + OUTLINE * 2) * pixelRatio

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Canvas 2D is not supported")
  }
  context.scale(pixelRatio, pixelRatio)
  context.translate(OUTLINE, OUTLINE)

  context.fillStyle = fill
  context.fill(BODY)
  context.lineWidth = OUTLINE
  context.strokeStyle = outline
  context.stroke(BODY)

  context.fillStyle = outline
  context.fill(WINDSHIELD)

  return { image: context.getImageData(0, 0, canvas.width, canvas.height), pixelRatio }
}
