// Size in CSS pixels. The train points north, MapLibre rotates it by bearing.
const WIDTH = 12
const HEIGHT = 30
const OUTLINE = 1.5

// SVG paths in a WIDTH × HEIGHT box. Can be replaced with paths exported from a design tool.
const BODY = new Path2D(
  "M 2 30 L 10 30 Q 12 30 12 27 L 12 9 C 12 4 9 0 6 0 C 3 0 0 4 0 9 L 0 27 Q 0 30 2 30 Z",
)
const WINDSHIELD = new Path2D("M 3 8 C 4 5 8 5 9 8 L 9 9 C 7 8 5 8 3 9 Z")

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
