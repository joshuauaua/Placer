// Slim replacement for konva/lib/_CoreInternals.js — imports only the
// modules ImaginationCanvas actually uses, dropping Animation, Tween,
// Easings and FastLayer. DragAndDrop is pulled in by Node.js, but its registry
// still has to be named here as Konva.DD, as _CoreInternals does: the stage asks
// Konva.isDragging() on every pointer move, which reads Konva.DD, and without it
// every move over the canvas threw.
import { Konva as Global } from 'konva/lib/Global.js'
import { Util, Transform } from 'konva/lib/Util.js'
import { Node } from 'konva/lib/Node.js'
import { Container } from 'konva/lib/Container.js'
import { Stage, stages } from 'konva/lib/Stage.js'
import { Layer } from 'konva/lib/Layer.js'
import { Group } from 'konva/lib/Group.js'
import { Shape, shapes } from 'konva/lib/Shape.js'
import { Context } from 'konva/lib/Context.js'
import { Canvas } from 'konva/lib/Canvas.js'
import { DD } from 'konva/lib/DragAndDrop.js'

export const Konva = Util._assign(Global, {
  Util,
  Transform,
  Node,
  Container,
  Stage,
  stages,
  Layer,
  Group,
  Shape,
  shapes,
  Context,
  Canvas,
  DD,
})

export default Konva
