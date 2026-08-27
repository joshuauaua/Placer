// Slim replacement for konva/lib/_CoreInternals.js — imports only the
// modules ImaginationCanvas actually uses, dropping Animation, Tween,
// Easings and FastLayer. DD (DragAndDrop) must stay: Global.isDragging()
// reads Konva['DD'].isDragging, and Stage._pointermove calls it on every
// pointer move, so a missing DD key throws on the canvas.
import { Konva as Global } from 'konva/lib/Global.js'
import { Util, Transform } from 'konva/lib/Util.js'
import { Node } from 'konva/lib/Node.js'
import { Container } from 'konva/lib/Container.js'
import { Stage, stages } from 'konva/lib/Stage.js'
import { Layer } from 'konva/lib/Layer.js'
import { Group } from 'konva/lib/Group.js'
import { DD } from 'konva/lib/DragAndDrop.js'
import { Shape, shapes } from 'konva/lib/Shape.js'
import { Context } from 'konva/lib/Context.js'
import { Canvas } from 'konva/lib/Canvas.js'

export const Konva = Util._assign(Global, {
  Util,
  Transform,
  Node,
  Container,
  Stage,
  stages,
  Layer,
  Group,
  DD,
  Shape,
  shapes,
  Context,
  Canvas,
})

export default Konva
