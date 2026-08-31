// Slim replacement for konva/lib/_CoreInternals.js — imports only the
// modules ImaginationCanvas actually uses, dropping Animation, Tween,
// Easings and FastLayer.
//
// DD has to be assigned, not merely imported: Konva.isDragging() in Global.js
// reads Konva['DD'], and every Stage pointer event goes through it — so leaving
// it off makes mousedown/mousemove on the canvas throw
// "Cannot read properties of undefined (reading 'isDragging')" and drawing stops
// working. Only in a real browser: jsdom never runs Konva's pointer pipeline, so
// the unit tests cannot see it. e2e/create-flow.e2e.js does.
import { Konva as Global } from 'konva/lib/Global.js'
import { Util, Transform } from 'konva/lib/Util.js'
import { Node } from 'konva/lib/Node.js'
import { Container } from 'konva/lib/Container.js'
import { DD } from 'konva/lib/DragAndDrop.js'
import { Stage, stages } from 'konva/lib/Stage.js'
import { Layer } from 'konva/lib/Layer.js'
import { Group } from 'konva/lib/Group.js'
import { Shape, shapes } from 'konva/lib/Shape.js'
import { Context } from 'konva/lib/Context.js'
import { Canvas } from 'konva/lib/Canvas.js'

export const Konva = Util._assign(Global, {
  Util,
  Transform,
  Node,
  Container,
  DD,
  Stage,
  stages,
  Layer,
  Group,
  Shape,
  shapes,
  Context,
  Canvas,
})

export default Konva
