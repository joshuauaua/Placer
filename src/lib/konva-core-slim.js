// Slim replacement for konva/lib/_CoreInternals.js — imports only the
// modules ImaginationCanvas actually uses, dropping Animation, Tween,
// Easings and FastLayer.
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

// DD must be assigned, not only imported: Konva.isDragging() in Global.js reads
// Konva.DD, and Stage calls it on every pointer event.
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
