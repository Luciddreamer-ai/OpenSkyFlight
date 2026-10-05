var ze = Object.defineProperty;
var Ve = (o, t, e) => t in o ? ze(o, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : o[t] = e;
var u = (o, t, e) => Ve(o, typeof t != "symbol" ? t + "" : t, e);
import { Matrix3 as Pe, Frustum as Fe, Vector3 as S, WebGLCoordinateSystem as Ce, Matrix4 as Ee, Object3D as ye, Box3 as je, Box3Helper as Oe, MeshStandardNodeMaterial as Re, FrontSide as Xe, BufferGeometry as Ge, BufferAttribute as O, LoadingManager as We, Vector2 as ne, Box2 as Ye, MeshBasicNodeMaterial as oe, Mesh as $e, Texture as J, CanvasTexture as Ze, ImageLoader as K, SRGBColorSpace as He, FileLoader as Ne, MathUtils as qe, LinearFilter as ie, Raycaster as Qe, Clock as Je } from "three";
import { Fn as xe, float as G, texture as R, varying as Ke, vec3 as $, positionLocal as et, uv as tt, vec2 as se, cross as rt, transformNormalToView as nt } from "three/tsl";
import { WorkerPool as ve } from "three/examples/jsm/utils/WorkerPool.js";
const z = "0.11.8-osf", Yt = { name: "GuoJF", email: "hz_gjf@163.com" }, ot = new Pe();
function it(o, t, e, r) {
  const n = ot.set(
    o.normal.x,
    o.normal.y,
    o.normal.z,
    t.normal.x,
    t.normal.y,
    t.normal.z,
    e.normal.x,
    e.normal.y,
    e.normal.z
  );
  return r.set(-o.constant, -t.constant, -e.constant), r.applyMatrix3(n.invert()), r;
}
class st extends Fe {
  constructor() {
    super();
    u(this, "points");
    this.points = Array(8).fill(0).map(() => new S());
  }
  setFromProjectionMatrix(e, r = Ce) {
    return super.setFromProjectionMatrix(e, r), this.calculateFrustumPoints(), this;
  }
  calculateFrustumPoints() {
    const { planes: e, points: r } = this;
    [
      [e[0], e[3], e[4]],
      // Near top left
      [e[1], e[3], e[4]],
      // Near top right
      [e[0], e[2], e[4]],
      // Near bottom left
      [e[1], e[2], e[4]],
      // Near bottom right
      [e[0], e[3], e[5]],
      // Far top left
      [e[1], e[3], e[5]],
      // Far top right
      [e[0], e[2], e[5]],
      // Far bottom left
      [e[1], e[2], e[5]]
      // Far bottom right
    ].forEach((i, a) => {
      it(i[0], i[1], i[2], r[a]);
    });
  }
}
var q = /* @__PURE__ */ ((o) => (o[o.none = 0] = "none", o[o.create = 1] = "create", o[o.remove = 2] = "remove", o))(q || {});
function at(o, t, e, r) {
  if (!o.isLeaf && o.z > e)
    return 2;
  const n = o.distRatio;
  let i = r;
  if (o.z > 13) {
    const a = Math.pow(1.4, o.z - 13), s = Math.max(o.viewCenterFactor, o.lookaheadFactor);
    i = r * (1 + (a - 1) * s);
  }
  return o.isLeaf && o.inFrustum && o.z < e && n < i && (o.showing || o.z <= t) ? 1 : !o.isLeaf && o.z >= t && n > i * 1.2 ? 2 : 0;
}
function V(o, t, e, r, n, i, a, s) {
  const l = new B(o, t, e);
  return l.position.set(r, n, 0), l.scale.set(i, a, s), l.updateMatrix(), l;
}
function lt(o, t) {
  const { x: e, y: r, z: n } = o, i = [], a = e * 2, s = n + 1, l = 0.25, c = 0.5, h = 1;
  if (n === 0 && t.projectionID === "4326") {
    const d = r, f = 1, m = V(a, d, s, -0.25, 0, c, f, h), w = V(a + 1, d, s, l, 0, c, f, h);
    i.push(m, w);
  } else {
    const d = r * 2, f = 0.5, m = V(a, d, s, -0.25, l, c, f, h), w = V(a + 1, d, s, l, l, c, f, h), g = V(a, d + 1, s, -0.25, -0.25, c, f, h), x = V(a + 1, d + 1, s, l, -0.25, c, f, h);
    i.push(m, w, g, x);
  }
  return i;
}
const ct = 10, P = new S(), C = new S();
let ae = 1;
const Z = new S();
let le = 1, H = !1;
const ce = new st(), ut = new Ee(), ue = new S();
class B extends ye {
  /**
   * 构造函数
   * @param x - 瓦片X坐标，默认：0
   * @param y - 瓦片Y坐标，默认：0
   * @param z - 瓦片层级，默认：0
   */
  constructor(e = 0, r = 0, n = 0) {
    super();
    /** 瓦片x坐标 */
    u(this, "x");
    /** 瓦片y坐标 */
    u(this, "y");
    /** 瓦片层级 */
    u(this, "z");
    /** 是否为瓦片 */
    u(this, "isTile", !0);
    /** 瓦片是否正在加载中 */
    u(this, "_isLoading", !1);
    /** 根瓦片 */
    u(this, "_root", this);
    /** 瓦片距离检测点世界坐标 */
    u(this, "_checkPoint", new S());
    /* 瓦片在世界坐标系中的大小*/
    u(this, "_sizeInWorld", -1);
    /** 瓦片包围盒（世界坐标） */
    u(this, "_bbox", null);
    /** 瓦片模型 */
    u(this, "_model");
    /** 子瓦片 */
    u(this, "_subTiles");
    // 是否更新材质
    u(this, "_updateMaterial", !1);
    // 是否更新几何体
    u(this, "_updateGeometry", !1);
    this.x = e, this.y = r, this.z = n, this.name = `Tile ${n}-${e}-${r}`, this.up.set(0, 0, 1), this.matrixAutoUpdate = !1;
  }
  get model() {
    return this._model;
  }
  get subTiles() {
    return this._subTiles;
  }
  /** 瓦片到相机的距离比例，用于 LOD 评估，值越小瓦片越密集 */
  get distRatio() {
    const r = P.distanceTo(this._checkPoint) / this._sizeInWorld;
    return this.inFrustum ? r * 0.8 : r * 2;
  }
  /** Factor [0,1] indicating how close this tile is to the view center ground point (1 = at center, 0 = beyond radius) */
  get viewCenterFactor() {
    const e = this._checkPoint.x - C.x, r = this._checkPoint.z - C.z, n = Math.sqrt(e * e + r * r);
    return Math.max(0, Math.min(1, 1 - n / ae));
  }
  /** Factor [0,1] indicating how close this tile is to the velocity-lookahead
   * point (0 when no lookahead is active) */
  get lookaheadFactor() {
    if (!H) return 0;
    const e = this._checkPoint.x - Z.x, r = this._checkPoint.z - Z.z, n = Math.sqrt(e * e + r * r);
    return Math.max(0, Math.min(1, 1 - n / le));
  }
  /** 瓦片是否在视锥体内 */
  get inFrustum() {
    return !!this._bbox && ce.intersectsBox(this._bbox);
  }
  /** 是否为叶子瓦片 */
  get isLeaf() {
    return !this.subTiles;
  }
  /** 取得瓦片是否显示 */
  get showing() {
    return !!this.model?.visible;
  }
  /** 设置瓦片是否显示 */
  set showing(e) {
    this.model ? (e && (this.model.castShadow = this._root.castShadow, this.model.receiveShadow = this._root.receiveShadow), e != this.showing && (this.model.traverse((r) => r.layers.set(e ? 0 : 31)), this.model.visible = e, this._root.dispatchEvent({ type: "tile-visible-changed", tile: this, visible: e }))) : console.assert(!e);
  }
  get _isDirty() {
    return !!this.model && (this._updateMaterial || this._updateGeometry);
  }
  /**
   * 瓦片射线检测，仅检测视锥体中的瓦片
   */
  raycast(e) {
    return this.inFrustum;
  }
  /**
   * 计算瓦片checkpoint、bbox、size
   */
  computeTileSize(e) {
    if (this._bbox = new je(new S(-0.5, -0.5), new S(0.5, 0.5)).applyMatrix4(this.matrixWorld), this._checkPoint = new S().applyMatrix4(this.matrixWorld), this._sizeInWorld = this._bbox.getSize(ue).length(), console.assert(this._sizeInWorld > 10), this._bbox.min.setY(-300), this._bbox.max.setY(9e3), e > 1) {
      const r = this._bbox.clone().applyMatrix4(this.matrixWorld.clone().invert()), n = new Oe(r, 1044480);
      n.name = "tilebox", this.add(n);
    }
    return this._sizeInWorld;
  }
  /**
   * 瓦片更新，该函数在每帧渲染中被调用
   * @param params 瓦片加载参数
   */
  update(e) {
    if (!this.parent || this._isLoading)
      return;
    this.parent instanceof B && (this._root = this.parent._root), console.assert(this._root.z === 0);
    const { loader: r, minLevel: n, camera: i } = e;
    if (this.z === 0) {
      i.getWorldPosition(P), ce.setFromProjectionMatrix(ut.multiplyMatrices(i.projectionMatrix, i.matrixWorldInverse));
      const a = i.getWorldDirection(ue);
      if (a.y < -0.01) {
        const l = -P.y / a.y;
        C.copy(a).multiplyScalar(l).add(P);
      } else
        C.copy(a).multiplyScalar(5e4).add(P), C.y = 0;
      ae = Math.max(500, P.y * 2);
      const s = e.lookahead;
      s && s.radius > 0 ? (Z.copy(s.point), le = s.radius, H = !0) : H = !1;
    }
    if (this._sizeInWorld < 0 && this.computeTileSize(r.debug), this.z >= n && r.downloadingThreads < ct) {
      if (!this.model) {
        this._startLoad(r);
        return;
      }
      if (this._isDirty && this.inFrustum && !this.subTiles?.some((s) => s._isDirty)) {
        this._startUpdate(r);
        return;
      }
    }
    this.model && (this.model.castShadow = this._root.castShadow, this.model.receiveShadow = this._root.receiveShadow), this.LOD(e), this.subTiles?.forEach((a) => a.update(e));
  }
  /**
   * LOD (Level of Detail).
   * @param threshold - LOD 阈值
   * @returns newTiles - 新创建的子瓦片数组
   */
  LOD(e) {
    const { loader: r, minLevel: n, maxLevel: i, LODThreshold: a } = e, s = at(this, n, i, a);
    if (s === q.create) {
      const l = lt(this, r);
      this.add(...l), this._subTiles = l, this._subTiles.forEach((c) => {
        c.updateMatrixWorld(), this._root.dispatchEvent({ type: "tile-created", tile: c });
      });
    } else s === q.remove && this.model && (this.showing = !0, this.unLoad(r, !1));
    return s;
  }
  /**
   * 检查4个兄弟瓦片全部下载完成时再显示
   */
  _checkVisible() {
    const e = this.parent;
    if (e instanceof B)
      if (e.model) {
        const r = e.subTiles;
        if (r) {
          const n = !r.some((i) => !i.model);
          r.forEach((i) => i.showing = n), e.showing = !n;
        }
      } else
        this.showing = !0;
    return this;
  }
  /**
   * 下载瓦片数据
   * @param loader  - 瓦片加载器
   */
  async _startLoad(e) {
    this._isLoading = !0, this._model = await e.load(this), this._model.geometry.computeBoundingBox(), this._checkPoint.y = this._model.geometry.boundingBox?.max.z || 0, this.isLeaf && this._checkVisible(), this._isLoading = !1, this._root.dispatchEvent({ type: "tile-loaded", tile: this }), this.add(this._model);
  }
  /**
   * 更新瓦片数据
   * @param loader - 瓦片加载器
   * @returns this
   */
  async _startUpdate(e) {
    this.model && (this._isLoading = !0, this._model = await e.update(this.model, this, this._updateMaterial, this._updateGeometry), this.model.geometry.computeBoundingBox(), this._checkPoint.y = this.model.geometry.boundingBox?.max.z || 0, this._updateMaterial = !1, this._updateGeometry = !1, this._isLoading = !1, this._root.dispatchEvent({ type: "tile-loaded", tile: this }));
  }
  /**
   * 更新瓦片数据
   * @param updateMaterial - 是否更新材质
   * @param updateGeometry - 是否更新几何体
   * @returns this
   */
  updateData(e, r) {
    return this.traverse((n) => {
      n instanceof B && (n.model || n._isLoading) && (n._updateMaterial = e, n._updateGeometry = r);
    }), this;
  }
  /**
   * 销毁瓦片树重新创建，并加载数据，改变地图投影时必须调用它以生效
   * @param loader - 瓦片加载器
   * @returns this
   */
  reload(e) {
    return this.unLoad(e, !0);
  }
  /**
   * 卸载瓦片 (包括其子瓦片)，释放资源
   * @param loader - 瓦片加载器
   * @param unLoadSelf - 是否卸载自身
   * @returns this
   */
  unLoad(e, r = !0) {
    return this.subTiles && (this.subTiles.forEach((n) => {
      n.unLoad(e, !0);
    }), this.remove(...this.subTiles), this._subTiles = void 0), r && this.model && (e.unload(this.model), this._root.dispatchEvent({ type: "tile-unload", tile: this }), this._model = void 0), e.debug > 1 && this.getObjectByName("tilebox")?.geometry.dispose(), this;
  }
}
class Me extends Re {
  constructor(t = {}) {
    super({ transparent: !1, side: Xe, ...t });
  }
}
const N = /* @__PURE__ */ xe(([o]) => o.r.mul(65280).add(o.g.mul(255)).add(o.b.mul(G(255).div(256))).sub(32768));
function $t(o, t) {
  const e = R(t), r = Ke($(0, 0, 1));
  return o.positionNode = xe(() => {
    const n = et.toVar(), i = tt(), a = R(t, i), s = N(a), l = G(1).div(128), c = N(R(t, i.add(se(l, 0)))), h = N(R(t, i.add(se(0, l)))), d = l, f = $(d, G(0), c.sub(s)), m = $(G(0), d, h.sub(s));
    return r.assign(rt(f, m).normalize()), n.z.addAssign(s), n;
  })(), o.normalNode = nt(r), { heightTextureNode: e };
}
var j = /* @__PURE__ */ ((o) => (o[o.Unknown = 0] = "Unknown", o[o.Point = 1] = "Point", o[o.Linestring = 2] = "Linestring", o[o.Polygon = 3] = "Polygon", o))(j || {});
class Zt {
  /**
   * 渲染矢量数据
   * @param ctx 渲染上下文
   * @param type 元素类型
   * @param feature 元素
   * @param style 样式
   * @param scale 拉伸倍数
   */
  render(t, e, r, n, i = 1) {
    switch (t.lineCap = "round", t.lineJoin = "round", (n.shadowBlur ?? 0) > 0 && (t.shadowBlur = n.shadowBlur ?? 2, t.shadowColor = n.shadowColor ?? "black", t.shadowOffsetX = n.shadowOffset ? n.shadowOffset[0] : 0, t.shadowOffsetY = n.shadowOffset ? n.shadowOffset[1] : 0), e) {
      case j.Point:
        t.textAlign = "center", t.textBaseline = "middle", t.font = n.font ?? "14px Arial", t.fillStyle = n.fontColor ?? "white", this._renderPointText(t, r, i, n.textField ?? "name", n.fontOffset ?? [0, -8]);
        break;
      case j.Linestring:
        this._renderLineString(t, r, i);
        break;
      case j.Polygon:
        this._renderPolygon(t, r, i);
        break;
      default:
        console.warn(`Unknown feature type: ${e}`);
    }
    (n.fill || e === j.Point) && (t.globalAlpha = n.fillOpacity || 0.5, t.fillStyle = n.fillColor || n.color || "#3388ff", t.fill(n.fillRule || "evenodd")), (n.stroke ?? !0) && (n.weight ?? 1) > 0 && (t.globalAlpha = n.opacity || 1, t.lineWidth = n.weight || 1, t.strokeStyle = n.color || "#3388ff", t.setLineDash(n.dashArray || []), t.stroke());
  }
  // 渲染点要素
  _renderPointText(t, e, r = 1, n = "name", i = [0, 0]) {
    const a = e.geometry;
    t.beginPath();
    for (const l of a)
      for (let c = 0; c < l.length; c++) {
        const h = l[c];
        t.arc(h.x * r, h.y * r, 2, 0, 2 * Math.PI);
      }
    const s = e.properties;
    s && s[n] && t.fillText(
      s[n],
      a[0][0].x * r + i[0],
      a[0][0].y * r + i[1]
    );
  }
  // 渲染线要素
  _renderLineString(t, e, r) {
    const n = e.geometry;
    t.beginPath();
    for (const i of n)
      for (let a = 0; a < i.length; a++) {
        const { x: s, y: l } = i[a];
        a === 0 ? t.moveTo(s * r, l * r) : t.lineTo(s * r, l * r);
      }
  }
  // 渲染面要素
  _renderPolygon(t, e, r) {
    const n = e.geometry;
    t.beginPath();
    for (let i = 0; i < n.length; i++) {
      const a = n[i];
      for (let s = 0; s < a.length; s++) {
        const { x: l, y: c } = a[s];
        s === 0 ? t.moveTo(l * r, c * r) : t.lineTo(l * r, c * r);
      }
      t.closePath();
    }
  }
}
function X(...o) {
  const t = o, e = t && t.length > 1 && t[0].constructor || null;
  if (!e)
    throw new Error(
      "concatenateTypedArrays - incorrect quantity of arguments or arguments have incompatible data types"
    );
  const r = t.reduce((a, s) => a + s.length, 0), n = new e(r);
  let i = 0;
  for (const a of t)
    n.set(a, i), i += a.length;
  return n;
}
function dt(o, t, e, r) {
  const n = r ? ft(r, o.position.value) : ht(t), i = n.length, a = new Float32Array(i * 6), s = new Float32Array(i * 4), l = new t.constructor(i * 6), c = new Float32Array(i * 6);
  for (let d = 0; d < i; d++)
    mt({
      edge: n[d],
      edgeIndex: d,
      attributes: o,
      skirtHeight: e,
      newPosition: a,
      newTexcoord0: s,
      newTriangles: l,
      newNormals: c
    });
  o.position.value = X(o.position.value, a), o.texcoord.value = X(o.texcoord.value, s), o.normal.value = X(o.normal.value, c);
  const h = X(t, l);
  return {
    attributes: o,
    indices: h
  };
}
function ht(o) {
  const t = [], e = Array.isArray(o) ? o : Array.from(o);
  for (let n = 0; n < e.length; n += 3) {
    const i = e[n], a = e[n + 1], s = e[n + 2];
    t.push([i, a], [a, s], [s, i]);
  }
  t.sort(([n, i], [a, s]) => {
    const l = Math.min(n, i), c = Math.min(a, s);
    return l !== c ? l - c : Math.max(n, i) - Math.max(a, s);
  });
  const r = [];
  for (let n = 0; n < t.length; n++)
    n + 1 < t.length && t[n][0] === t[n + 1][1] && t[n][1] === t[n + 1][0] ? n++ : r.push(t[n]);
  return r;
}
function ft(o, t) {
  const e = (n, i) => {
    n.sort(i);
  };
  e(o.westIndices, (n, i) => t[3 * n + 1] - t[3 * i + 1]), e(o.eastIndices, (n, i) => t[3 * i + 1] - t[3 * n + 1]), e(o.southIndices, (n, i) => t[3 * i] - t[3 * n]), e(o.northIndices, (n, i) => t[3 * n] - t[3 * i]);
  const r = [];
  return Object.values(o).forEach((n) => {
    if (n.length > 1)
      for (let i = 0; i < n.length - 1; i++)
        r.push([n[i], n[i + 1]]);
  }), r;
}
function mt({
  edge: o,
  edgeIndex: t,
  attributes: e,
  skirtHeight: r,
  newPosition: n,
  newTexcoord0: i,
  newTriangles: a,
  newNormals: s
}) {
  const l = e.position.value.length, c = t * 2, h = c + 1;
  n.set(e.position.value.subarray(o[0] * 3, o[0] * 3 + 3), c * 3), n[c * 3 + 2] = n[c * 3 + 2] - r, n.set(e.position.value.subarray(o[1] * 3, o[1] * 3 + 3), h * 3), n[h * 3 + 2] = n[h * 3 + 2] - r, i.set(e.texcoord.value.subarray(o[0] * 2, o[0] * 2 + 2), c * 2), i.set(e.texcoord.value.subarray(o[1] * 2, o[1] * 2 + 2), h * 2);
  const d = t * 2 * 3;
  a[d] = o[0], a[d + 1] = l / 3 + h, a[d + 2] = o[1], a[d + 3] = l / 3 + h, a[d + 4] = o[0], a[d + 5] = l / 3 + c, s[d] = 0, s[d + 1] = 0, s[d + 2] = 1, s[d + 3] = 0, s[d + 4] = 0, s[d + 5] = 1;
}
function gt(o) {
  if (o.length < 4)
    throw new Error(`DEM array must > 4, got ${o.length}!`);
  const t = Math.floor(Math.sqrt(o.length)), e = t, r = t, n = be(r, e);
  return { attributes: pt(o, r, e), indices: n };
}
function pt(o, t, e) {
  const r = e * t, n = new Float32Array(r * 3), i = new Float32Array(r * 2);
  let a = 0;
  for (let s = 0; s < t; s++)
    for (let l = 0; l < e; l++) {
      const c = l / (e - 1), h = s / (t - 1);
      i[a * 2] = c, i[a * 2 + 1] = h, n[a * 3] = c - 0.5, n[a * 3 + 1] = h - 0.5, n[a * 3 + 2] = o[(t - s - 1) * e + l], a++;
    }
  return {
    // 顶点位置属性
    position: { value: n, size: 3 },
    // UV坐标属性
    texcoord: { value: i, size: 2 },
    // 法线属性
    normal: { value: ke(n, be(t, e)), size: 3 }
  };
}
function be(o, t) {
  const e = 6 * (t - 1) * (o - 1), r = new Uint16Array(e);
  let n = 0;
  for (let i = 0; i < o - 1; i++)
    for (let a = 0; a < t - 1; a++) {
      const s = i * t + a, l = s + 1, c = s + t, h = c + 1, d = n * 6;
      r[d] = s, r[d + 1] = l, r[d + 2] = c, r[d + 3] = c, r[d + 4] = l, r[d + 5] = h, n++;
    }
  return r;
}
function ke(o, t) {
  const e = new Float32Array(o.length);
  for (let r = 0; r < t.length; r += 3) {
    const n = t[r] * 3, i = t[r + 1] * 3, a = t[r + 2] * 3, s = o[n], l = o[n + 1], c = o[n + 2], h = o[i], d = o[i + 1], f = o[i + 2], m = o[a], w = o[a + 1], g = o[a + 2], x = h - s, A = d - l, p = f - c, v = m - s, L = w - l, k = g - c, M = A * k - p * L, b = p * v - x * k, T = x * L - A * v, U = Math.sqrt(M * M + b * b + T * T), D = [0, 0, 1];
    if (U > 0) {
      const I = 1 / U;
      D[0] = M * I, D[1] = b * I, D[2] = T * I;
    }
    for (let I = 0; I < 3; I++)
      e[n + I] = e[i + I] = e[a + I] = D[I];
  }
  return e;
}
class F extends Ge {
  constructor() {
    super();
    u(this, "type", "TileGeometry");
    const e = new Float32Array([0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0]);
    this.setData(e);
  }
  /**
   * set attribute data to geometry
   * @param data geometry or DEM data
   * @returns this
   */
  setData(e, r = 1e3) {
    let n = e instanceof Float32Array ? gt(e) : e;
    n = dt(n.attributes, n.indices, r);
    const { attributes: i, indices: a } = n;
    return this.setIndex(new O(a, 1)), this.setAttribute("position", new O(i.position.value, i.position.size)), this.setAttribute("uv", new O(i.texcoord.value, i.texcoord.size)), this.setAttribute("normal", new O(i.normal.value, i.normal.size)), this.computeBoundingBox(), this.computeBoundingSphere(), this;
  }
}
class Ht {
  /**
   * Constructor for the generator.
   *
   * @param gridSize - Size of the grid.
   */
  constructor(t = 257) {
    /**
     * Size of the grid to be generated.
     */
    u(this, "gridSize");
    /**
     * Number of triangles to be used in the tile.
     */
    u(this, "numTriangles");
    /**
     * Number of triangles in the parent node.
     */
    u(this, "numParentTriangles");
    /**
     * Indices of the triangles faces.
     */
    u(this, "indices");
    /**
     * Coordinates of the points composing the mesh.
     */
    u(this, "coords");
    this.gridSize = t;
    const e = t - 1;
    if (e & e - 1)
      throw new Error(`Expected grid size to be 2^n+1, got ${t}.`);
    this.numTriangles = e * e * 2 - 2, this.numParentTriangles = this.numTriangles - e * e, this.indices = new Uint32Array(this.gridSize * this.gridSize), this.coords = new Uint16Array(this.numTriangles * 4);
    for (let r = 0; r < this.numTriangles; r++) {
      let n = r + 2, i = 0, a = 0, s = 0, l = 0, c = 0, h = 0;
      for (n & 1 ? s = l = c = e : i = a = h = e; (n >>= 1) > 1; ) {
        const f = i + s >> 1, m = a + l >> 1;
        n & 1 ? (s = i, l = a, i = c, a = h) : (i = s, a = l, s = c, l = h), c = f, h = m;
      }
      const d = r * 4;
      this.coords[d + 0] = i, this.coords[d + 1] = a, this.coords[d + 2] = s, this.coords[d + 3] = l;
    }
  }
  createTile(t) {
    return new wt(t, this);
  }
}
class wt {
  constructor(t, e) {
    /**
     * Pointer to the martini generator object.
     */
    u(this, "martini");
    /**
     * Terrain to generate the tile for.
     */
    u(this, "terrain");
    /**
     * Errors detected while creating the tile.
     */
    u(this, "errors");
    const r = e.gridSize;
    if (t.length !== r * r)
      throw new Error(
        `Expected terrain data of length ${r * r} (${r} x ${r}), got ${t.length}.`
      );
    this.terrain = t, this.martini = e, this.errors = new Float32Array(t.length), this.update();
  }
  update() {
    const { numTriangles: t, numParentTriangles: e, coords: r, gridSize: n } = this.martini, { terrain: i, errors: a } = this;
    for (let s = t - 1; s >= 0; s--) {
      const l = s * 4, c = r[l + 0], h = r[l + 1], d = r[l + 2], f = r[l + 3], m = c + d >> 1, w = h + f >> 1, g = m + w - h, x = w + c - m, A = (i[h * n + c] + i[f * n + d]) / 2, p = w * n + m, v = Math.abs(A - i[p]);
      if (a[p] = Math.max(a[p], v), s < e) {
        const L = (h + x >> 1) * n + (c + g >> 1), k = (f + x >> 1) * n + (d + g >> 1);
        a[p] = Math.max(a[p], a[L], a[k]);
      }
    }
  }
  getGeometryData(t = 0) {
    const { gridSize: e, indices: r } = this.martini, { errors: n } = this;
    let i = 0, a = 0;
    const s = e - 1;
    let l, c, h = 0;
    r.fill(0);
    function d(p, v, L, k, M, b) {
      const T = p + L >> 1, U = v + k >> 1;
      Math.abs(p - M) + Math.abs(v - b) > 1 && n[U * e + T] > t ? (d(M, b, p, v, T, U), d(L, k, M, b, T, U)) : (l = v * e + p, c = k * e + L, h = b * e + M, r[l] === 0 && (r[l] = ++i), r[c] === 0 && (r[c] = ++i), r[h] === 0 && (r[h] = ++i), a++);
    }
    d(0, 0, s, s, s, 0), d(s, s, 0, 0, 0, s);
    const f = i * 2, m = a * 3, w = new Uint16Array(f), g = new Uint32Array(m);
    let x = 0;
    function A(p, v, L, k, M, b) {
      const T = p + L >> 1, U = v + k >> 1;
      if (Math.abs(p - M) + Math.abs(v - b) > 1 && n[U * e + T] > t)
        A(M, b, p, v, T, U), A(L, k, M, b, T, U);
      else {
        const D = r[v * e + p] - 1, I = r[k * e + L] - 1, Y = r[b * e + M] - 1;
        w[2 * D] = p, w[2 * D + 1] = v, w[2 * I] = L, w[2 * I + 1] = k, w[2 * Y] = M, w[2 * Y + 1] = b, g[x++] = D, g[x++] = I, g[x++] = Y;
      }
    }
    return A(0, 0, s, s, s, 0), A(s, s, 0, 0, 0, s), {
      attributes: this._getMeshAttributes(this.terrain, w, g),
      indices: g
    };
  }
  _getMeshAttributes(t, e, r) {
    const n = Math.floor(Math.sqrt(t.length)), i = n - 1, a = e.length / 2, s = new Float32Array(a * 3), l = new Float32Array(a * 2);
    for (let h = 0; h < a; h++) {
      const d = e[h * 2], f = e[h * 2 + 1], m = f * n + d;
      s[3 * h + 0] = d / i - 0.5, s[3 * h + 1] = 0.5 - f / i, s[3 * h + 2] = t[m], l[2 * h + 0] = d / i, l[2 * h + 1] = 1 - f / i;
    }
    const c = ke(s, r);
    return {
      position: { value: s, size: 3 },
      texcoord: { value: l, size: 2 },
      normal: { value: c, size: 3 }
    };
  }
}
class yt extends We {
  constructor() {
    super(...arguments);
    u(this, "onParseEnd");
  }
  parseEnd(e) {
    this.onParseEnd && this.onParseEnd(e);
  }
}
const de = { name: "GuoJF" }, y = {
  manager: new yt(),
  // Dict of dem loader
  demLoaderMap: /* @__PURE__ */ new Map(),
  // Dict of img loader
  imgLoaderMap: /* @__PURE__ */ new Map(),
  /**
   * Register material loader
   * @param loader material loader
   */
  registerMaterialLoader(o) {
    y.imgLoaderMap.set(o.dataType, o), o.info.author = o.info.author ?? de.name;
  },
  /**
   * Register geometry loader
   * @param loader geometry loader
   */
  registerGeometryLoader(o) {
    y.demLoaderMap.set(o.dataType, o), o.info.author = o.info.author ?? de.name;
  },
  /**
   * Get material loader from datasource
   * @param source datasource
   * @returns material loader
   */
  getMaterialLoader(o) {
    const t = typeof o == "string" ? o : o.dataType, e = y.imgLoaderMap.get(t);
    if (e)
      return e;
    throw `Image source dataType "${t}" is not support!`;
  },
  /**
   * Get geometry loader from datasource
   * @param source datasouce
   * @returns geometry loader
   */
  getGeometryLoader(o) {
    const t = typeof o == "string" ? o : o.dataType, e = y.demLoaderMap.get(t);
    if (e)
      return e;
    throw `Terrain source dataType "${t}" is not support!`;
  },
  /**
   * Get all loaders
   * @returns Image loaders and terrain loaders
   */
  getLoaders() {
    return {
      imgLoaders: Array.from(y.imgLoaderMap.values()),
      demLoaders: Array.from(y.demLoaderMap.values())
    };
  }
};
class Nt {
  /**
   * 构造函数
   *
   * @param creator 创建一个 Worker 实例的函数
   */
  constructor(t) {
    u(this, "worker");
    this.worker = t();
  }
  /**
   * 异步执行worker任务，并返回结果。
   *
   * @param message 要传递给worker的消息。
   * @param transfer 可转移对象的数组，用于优化内存传输。
   * @returns 返回一个Promise，解析为worker返回的结果。
   */
  async run(t, e) {
    return new Promise((r) => {
      this.worker.onmessage = (n) => {
        r(n.data);
      }, this.worker.postMessage(t, e);
    });
  }
  /**
   * 终止当前工作进程。
   */
  terminate() {
    this.worker.terminate();
  }
}
function ee(o, t) {
  const e = Math.floor(o[0] * t), r = Math.floor(o[1] * t), n = Math.floor((o[2] - o[0]) * t), i = Math.floor((o[3] - o[1]) * t);
  return { sx: e, sy: r, sw: n, sh: i };
}
function Le(o, t, e, r) {
  if (r < o.minLevel)
    return {
      url: void 0,
      clipBounds: [0, 0, 1, 1]
    };
  if (r <= o.maxLevel)
    return {
      url: o.getUrl(t, e, r),
      clipBounds: [0, 0, 1, 1]
    };
  const n = vt(t, e, r, o.maxLevel), i = n.parentCoord;
  return { url: o.getUrl(i.x, i.y, i.z), clipBounds: n.bounds };
}
function xt(o, t) {
  const e = o.width, r = new OffscreenCanvas(e, e), n = r.getContext("2d"), { sx: i, sy: a, sw: s, sh: l } = ee(t, o.width);
  return n.drawImage(o, i, a, s, l, 0, 0, e, e), r;
}
function vt(o, t, e, r) {
  const n = e - r, i = { x: o >> n, y: t >> n, z: e - n }, a = Math.pow(2, n), s = Math.pow(0.5, n), l = o % a / a - 0.5 + s / 2, c = t % a / a - 0.5 + s / 2, h = new ne(l, c), d = new Ye().setFromCenterAndSize(h, new ne(s, s)), f = [d.min.x + 0.5, d.min.y + 0.5, d.max.x + 0.5, d.max.y + 0.5];
  return { parentCoord: i, bounds: f };
}
function Mt(o, t, e) {
  if (t[0] <= e[0] && t[1] <= e[1] && t[2] >= e[2] && t[3] >= e[3])
    return o;
  const [r, n, i, a] = t, [s, l, c, h] = e, d = Math.max(r, s), f = Math.max(n, l), m = Math.min(i, c), w = Math.min(a, h);
  if (d >= m || f >= w)
    return o;
  const g = new OffscreenCanvas(o.width, o.height), x = g.getContext("2d");
  x.drawImage(o, 0, 0);
  const A = Math.max(s, r), p = Math.min(c, i), v = Math.max(l, n), L = Math.min(h, a);
  x.globalCompositeOperation = "destination-in";
  const k = c - s, M = h - l, b = (A - s) / k * g.width, T = (p - s) / k * g.width, U = g.height - (L - l) / M * g.height, D = g.height - (v - l) / M * g.height;
  return x.beginPath(), x.rect(b, U, T - b, D - U), x.fill(), g;
}
const _ = class _ {
  constructor() {
    u(this, "_bounds", [-180, -85, 180, 85]);
    u(this, "_imgSource", []);
    u(this, "_demSource");
    /** Error material */
    u(this, "_errorMaterial", new oe({
      color: 16711680,
      transparent: !0,
      opacity: 0,
      name: "error-material"
    }));
    /** Error geometry */
    u(this, "_errorGeometry", new F());
    /** Background material */
    u(this, "backgroundMaterial", new oe({ color: 1122867 }));
    /** Debug single */
    u(this, "debug", 0);
  }
  get bounds() {
    return this._bounds;
  }
  set bounds(t) {
    this._bounds = t;
  }
  /** Get downloading threads */
  get downloadingThreads() {
    return _._downloadingThreads;
  }
  /** Get image source */
  get imgSource() {
    return this._imgSource;
  }
  /** Set image source */
  set imgSource(t) {
    this._imgSource = t;
  }
  /** Get DEM source */
  get demSource() {
    return this._demSource;
  }
  /** Set DEM source */
  set demSource(t) {
    this._demSource = t;
  }
  get projectionID() {
    return this.imgSource[0].projectionID;
  }
  /** Loader manager */
  get manager() {
    return y.manager;
  }
  /**
   * Load getmetry and materail of tile from x, y and z coordinate.
   * @returns Promise<MeshDateType> tile data
   */
  async load(t) {
    const e = await this.loadGeometry(t), r = await this.loadMaterial(t);
    console.assert(!!r && !!e), e.clearGroups();
    for (let i = 0; i < r.length; i++)
      i === 0 && console.assert(r[i] === this.backgroundMaterial), e.addGroup(0, 1 / 0, i);
    return console.assert(r.length === e.groups.length), new $e(e, r);
  }
  async updateGeometry(t, e) {
    const r = t.geometry;
    t.geometry = await this.loadGeometry(e), t.geometry.groups = r.groups, r.dispose();
  }
  async updateMaterial(t, e) {
    const r = Array.isArray(t.material) ? t.material : [t.material], n = await this.loadMaterial(e);
    t.material = n, t.geometry.clearGroups();
    for (let i = 0; i < n.length; i++)
      t.geometry.addGroup(0, 1 / 0, i);
    for (let i = 0; i < r.length; i++)
      r[i].dispose();
  }
  /**
   * Update tile mesh data
   * @param tileMesh tile mesh
   */
  async update(t, e, r, n) {
    return n && await this.updateGeometry(t, e), r && await this.updateMaterial(t, e), t;
  }
  /**
   * Unload tile mesh data
   * @param tileMesh tile mesh
   */
  unload(t) {
    const e = Array.isArray(t.material) ? t.material : [t.material];
    for (let r = 0; r < e.length; r++)
      e[r].dispose(), t.geometry.groups.pop();
    t.geometry.dispose();
  }
  /**
   * Load geometry
   * @returns BufferGeometry
   */
  async loadGeometry(t) {
    let e;
    const { bounds: r, z: n } = t;
    if (this.demSource && n >= this.demSource.minLevel && this._intersectsBounds(this.demSource, r)) {
      const i = y.getGeometryLoader(this.demSource), a = this.demSource;
      if (_._downloadingThreads++, e = await i.load({ source: a, ...t }).catch((s) => (this.debug > 0 && console.error("Load Geometry Error:", s), this._errorGeometry)).finally(() => {
        _._downloadingThreads--;
      }), e != this._errorGeometry) {
        const s = (l) => {
          i.unload && i.unload(l.target), l.target.removeEventListener("dispose", s);
        };
        e.addEventListener("dispose", s);
      }
    } else
      e = new F();
    return e;
  }
  /**
   * Load material
   * @param x x coordinate of tile
   * @param y y coordinate of tile
   * @param z z coordinate of tile
   * @returns Material[]
   */
  async loadMaterial(t) {
    const e = [this.backgroundMaterial], { bounds: r, z: n } = t, i = this.imgSource.filter((a) => n >= a.minLevel && this._intersectsBounds(a, r));
    for (let a = 0; a < i.length; a++) {
      const s = i[a], l = y.getMaterialLoader(s);
      _._downloadingThreads++;
      const c = await l.load({ source: s, ...t }).catch((h) => (this.debug > 0 && console.error("Load Material Error:", h), this._errorMaterial)).finally(() => {
        _._downloadingThreads--;
      });
      if (c !== this._errorMaterial && c !== this.backgroundMaterial) {
        if ("map" in c && c.map instanceof J) {
          const d = c.map;
          d.image && (d.image = Mt(d.image, s._projectionBounds, t.bounds)), d.needsUpdate = !0;
        }
        c.opacity = s.opacity, c.transparent = s.transparent;
        const h = (d) => {
          l.unload && l.unload(d.target), d.target.removeEventListener("dispose", h);
        };
        c.addEventListener("dispose", h), e.push(c);
      }
    }
    return e;
  }
  /**
   * Check the tile is in the source bounds. (projection coordinate)
   * @returns true in the bounds,else false
   */
  _intersectsBounds(t, e) {
    const r = t._projectionBounds;
    return e[2] >= r[0] && e[3] >= r[1] && e[0] <= r[2] && e[1] <= r[3];
  }
};
u(_, "_downloadingThreads", 0);
let Q = _;
class te {
  constructor() {
    u(this, "info", {
      version: z,
      description: "Terrain loader base class"
    });
    u(this, "dataType", "");
  }
  /**
   * load tile's data from source
   * @param source
   * @param tile
   * @param onError
   * @returns
   */
  async load(t) {
    const { source: e, x: r, y: n, z: i } = t, { url: a, clipBounds: s } = Le(e, r, n, i);
    if (!a)
      return new F();
    const l = await this.doLoad(a, { ...t, clipBounds: s });
    return y.manager.parseEnd(l), l;
  }
}
class bt {
  constructor() {
    u(this, "info", {
      version: z,
      description: "Image loader base class"
    });
    u(this, "dataType", "");
    u(this, "_material", new Me());
  }
  /** 取得默认材质 */
  get material() {
    return this._material;
  }
  /** 设置默认材质 */
  set material(t) {
    this.material.dispose(), this._material = t;
  }
  /**
   * Load tile material from source
   * @param source
   * @param tile
   * @returns
   */
  async load(t) {
    const { source: e, x: r, y: n, z: i } = t, a = this.createMaterial(), { url: s, clipBounds: l } = Le(e, r, n, i);
    return s && (a.map = await this.doLoad(s, { ...t, clipBounds: l })), a;
  }
  /**
   * Dispose material
   * @param material material
   */
  unload(t) {
    const e = t.map;
    e && (e.image instanceof ImageBitmap && e.image.close(), e.dispose());
  }
  /**
   * Create material
   * @returns {ITileMaterial} the material of tile
   */
  createMaterial() {
    return this.material.clone();
  }
  /**
   * Download terrain data
   * @param url url
   * @returns {Promise<TBuffer>} the buffer of download data
   */
  async doLoad(t, e) {
    return Promise.resolve(void 0);
  }
}
class kt {
  constructor() {
    u(this, "info", {
      version: z,
      description: "Canvas tile abstract loader"
    });
    u(this, "dataType", "");
  }
  /**
   * Asynchronously load tile material
   * @param params Tile loading parameters
   * @returns Returns the tile material
   */
  async load(t) {
    const e = this._creatCanvasContext(256, 256);
    this.drawTile(e, t);
    const r = new Ze(e.canvas);
    return new Me({
      transparent: !0,
      map: r,
      opacity: t.source.opacity
    });
  }
  _creatCanvasContext(t, e) {
    const n = new OffscreenCanvas(t, e).getContext("2d");
    if (!n)
      throw new Error("create canvas context failed");
    return n;
  }
  unload(t) {
    const e = t.map;
    e && (e.image instanceof ImageBitmap && e.image.close(), e.dispose());
  }
}
class Lt extends bt {
  constructor() {
    super(...arguments);
    u(this, "info", {
      version: z,
      description: "Tile image loader. It can load xyz tile image."
    });
    u(this, "dataType", "image");
    u(this, "loader", new K(y.manager));
  }
  /**
   * 加载瓦片图像作为纹理
   *
   * @param url 图像资源的URL
   * @param params 加载参数，包括x, y, z坐标、投影范围，裁剪边界clipBounds
   * @returns 返回一个Promise对象，解析为HTMLImageElement类型。
   */
  async doLoad(e, r) {
    const n = await this.loader.loadAsync(e), i = new J();
    i.colorSpace = He, i.image = n;
    const a = r.clipBounds;
    return a[2] - a[0] < 1 && (i.image = xt(n, a)), i;
  }
}
Be(new Lt());
const Ie = 'var ce=Object.defineProperty;var me=(j,Z,q)=>Z in j?ce(j,Z,{enumerable:!0,configurable:!0,writable:!0,value:q}):j[Z]=q;var N=(j,Z,q)=>me(j,typeof Z!="symbol"?Z+"":Z,q);(function(){"use strict";function j(A,p){const k=new Float32Array(A.length);for(let U=0;U<p.length;U+=3){const a=p[U]*3,e=p[U+1]*3,r=p[U+2]*3,s=A[a],t=A[a+1],n=A[a+2],h=A[e],i=A[e+1],o=A[e+2],c=A[r],u=A[r+1],m=A[r+2],w=h-s,l=i-t,f=o-n,g=c-s,M=u-t,V=m-n,d=l*V-f*M,y=f*g-w*V,I=w*M-l*g,z=Math.sqrt(d*d+y*y+I*I),x=[0,0,1];if(z>0){const v=1/z;x[0]=d*v,x[1]=y*v,x[2]=I*v}for(let v=0;v<3;v++)k[a+v]=k[e+v]=k[r+v]=x[v]}return k}class Z{constructor(p=257){N(this,"gridSize");N(this,"numTriangles");N(this,"numParentTriangles");N(this,"indices");N(this,"coords");this.gridSize=p;const k=p-1;if(k&k-1)throw new Error(`Expected grid size to be 2^n+1, got ${p}.`);this.numTriangles=k*k*2-2,this.numParentTriangles=this.numTriangles-k*k,this.indices=new Uint32Array(this.gridSize*this.gridSize),this.coords=new Uint16Array(this.numTriangles*4);for(let U=0;U<this.numTriangles;U++){let a=U+2,e=0,r=0,s=0,t=0,n=0,h=0;for(a&1?s=t=n=k:e=r=h=k;(a>>=1)>1;){const o=e+s>>1,c=r+t>>1;a&1?(s=e,t=r,e=n,r=h):(e=s,r=t,s=n,t=h),n=o,h=c}const i=U*4;this.coords[i+0]=e,this.coords[i+1]=r,this.coords[i+2]=s,this.coords[i+3]=t}}createTile(p){return new q(p,this)}}class q{constructor(p,k){N(this,"martini");N(this,"terrain");N(this,"errors");const U=k.gridSize;if(p.length!==U*U)throw new Error(`Expected terrain data of length ${U*U} (${U} x ${U}), got ${p.length}.`);this.terrain=p,this.martini=k,this.errors=new Float32Array(p.length),this.update()}update(){const{numTriangles:p,numParentTriangles:k,coords:U,gridSize:a}=this.martini,{terrain:e,errors:r}=this;for(let s=p-1;s>=0;s--){const t=s*4,n=U[t+0],h=U[t+1],i=U[t+2],o=U[t+3],c=n+i>>1,u=h+o>>1,m=c+u-h,w=u+n-c,l=(e[h*a+n]+e[o*a+i])/2,f=u*a+c,g=Math.abs(l-e[f]);if(r[f]=Math.max(r[f],g),s<k){const M=(h+w>>1)*a+(n+m>>1),V=(o+w>>1)*a+(i+m>>1);r[f]=Math.max(r[f],r[M],r[V])}}}getGeometryData(p=0){const{gridSize:k,indices:U}=this.martini,{errors:a}=this;let e=0,r=0;const s=k-1;let t,n,h=0;U.fill(0);function i(f,g,M,V,d,y){const I=f+M>>1,z=g+V>>1;Math.abs(f-d)+Math.abs(g-y)>1&&a[z*k+I]>p?(i(d,y,f,g,I,z),i(M,V,d,y,I,z)):(t=g*k+f,n=V*k+M,h=y*k+d,U[t]===0&&(U[t]=++e),U[n]===0&&(U[n]=++e),U[h]===0&&(U[h]=++e),r++)}i(0,0,s,s,s,0),i(s,s,0,0,0,s);const o=e*2,c=r*3,u=new Uint16Array(o),m=new Uint32Array(c);let w=0;function l(f,g,M,V,d,y){const I=f+M>>1,z=g+V>>1;if(Math.abs(f-d)+Math.abs(g-y)>1&&a[z*k+I]>p)l(d,y,f,g,I,z),l(M,V,d,y,I,z);else{const x=U[g*k+f]-1,v=U[V*k+M]-1,D=U[y*k+d]-1;u[2*x]=f,u[2*x+1]=g,u[2*v]=M,u[2*v+1]=V,u[2*D]=d,u[2*D+1]=y,m[w++]=x,m[w++]=v,m[w++]=D}}return l(0,0,s,s,s,0),l(s,s,0,0,0,s),{attributes:this._getMeshAttributes(this.terrain,u,m),indices:m}}_getMeshAttributes(p,k,U){const a=Math.floor(Math.sqrt(p.length)),e=a-1,r=k.length/2,s=new Float32Array(r*3),t=new Float32Array(r*2);for(let h=0;h<r;h++){const i=k[h*2],o=k[h*2+1],c=o*a+i;s[3*h+0]=i/e-.5,s[3*h+1]=.5-o/e,s[3*h+2]=p[c],t[2*h+0]=i/e,t[2*h+1]=1-o/e}const n=j(s,U);return{position:{value:s,size:3},texcoord:{value:t,size:2},normal:{value:n,size:3}}}}/* Copyright 2015-2021 Esri. Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 @preserve */const ee=(function(){var A={};A.defaultNoDataValue=-34027999387901484e22,A.decode=function(r,s){s=s||{};var t=s.encodedMaskData||s.encodedMaskData===null,n=a(r,s.inputOffset||0,t),h=s.noDataValue!==null?s.noDataValue:A.defaultNoDataValue,i=p(n,s.pixelType||Float32Array,s.encodedMaskData,h,s.returnMask),o={width:n.width,height:n.height,pixelData:i.resultPixels,minValue:i.minValue,maxValue:n.pixels.maxValue,noDataValue:h};return i.resultMask&&(o.maskData=i.resultMask),s.returnEncodedMask&&n.mask&&(o.encodedMaskData=n.mask.bitset?n.mask.bitset:null),s.returnFileInfo&&(o.fileInfo=k(n),s.computeUsedBitDepths&&(o.fileInfo.bitDepths=U(n))),o};var p=function(r,s,t,n,h){var i=0,o=r.pixels.numBlocksX,c=r.pixels.numBlocksY,u=Math.floor(r.width/o),m=Math.floor(r.height/c),w=2*r.maxZError,l=Number.MAX_VALUE,f;t=t||(r.mask?r.mask.bitset:null);var g,M;g=new s(r.width*r.height),h&&t&&(M=new Uint8Array(r.width*r.height));for(var V=new Float32Array(u*m),d,y,I=0;I<=c;I++){var z=I!==c?m:r.height%c;if(z!==0)for(var x=0;x<=o;x++){var v=x!==o?u:r.width%o;if(v!==0){var D=I*r.width*m+x*u,T=r.width-v,S=r.pixels.blocks[i],B,L,F;S.encoding<2?(S.encoding===0?B=S.rawData:(e(S.stuffedData,S.bitsPerPixel,S.numValidPixels,S.offset,w,V,r.pixels.maxValue),B=V),L=0):S.encoding===2?F=0:F=S.offset;var b;if(t)for(y=0;y<z;y++){for(D&7&&(b=t[D>>3],b<<=D&7),d=0;d<v;d++)D&7||(b=t[D>>3]),b&128?(M&&(M[D]=1),f=S.encoding<2?B[L++]:F,l=l>f?f:l,g[D++]=f):(M&&(M[D]=0),g[D++]=n),b<<=1;D+=T}else if(S.encoding<2)for(y=0;y<z;y++){for(d=0;d<v;d++)f=B[L++],l=l>f?f:l,g[D++]=f;D+=T}else for(l=l>F?F:l,y=0;y<z;y++){for(d=0;d<v;d++)g[D++]=F;D+=T}if(S.encoding===1&&L!==S.numValidPixels)throw"Block and Mask do not match";i++}}}return{resultPixels:g,resultMask:M,minValue:l}},k=function(r){return{fileIdentifierString:r.fileIdentifierString,fileVersion:r.fileVersion,imageType:r.imageType,height:r.height,width:r.width,maxZError:r.maxZError,eofOffset:r.eofOffset,mask:r.mask?{numBlocksX:r.mask.numBlocksX,numBlocksY:r.mask.numBlocksY,numBytes:r.mask.numBytes,maxValue:r.mask.maxValue}:null,pixels:{numBlocksX:r.pixels.numBlocksX,numBlocksY:r.pixels.numBlocksY,numBytes:r.pixels.numBytes,maxValue:r.pixels.maxValue,noDataValue:r.noDataValue}}},U=function(r){for(var s=r.pixels.numBlocksX*r.pixels.numBlocksY,t={},n=0;n<s;n++){var h=r.pixels.blocks[n];h.encoding===0?t.float32=!0:h.encoding===1?t[h.bitsPerPixel]=!0:t[0]=!0}return Object.keys(t)},a=function(r,s,t){var n={},h=new Uint8Array(r,s,10);if(n.fileIdentifierString=String.fromCharCode.apply(null,h),n.fileIdentifierString.trim()!=="CntZImage")throw"Unexpected file identifier string: "+n.fileIdentifierString;s+=10;var i=new DataView(r,s,24);if(n.fileVersion=i.getInt32(0,!0),n.imageType=i.getInt32(4,!0),n.height=i.getUint32(8,!0),n.width=i.getUint32(12,!0),n.maxZError=i.getFloat64(16,!0),s+=24,!t)if(i=new DataView(r,s,16),n.mask={},n.mask.numBlocksY=i.getUint32(0,!0),n.mask.numBlocksX=i.getUint32(4,!0),n.mask.numBytes=i.getUint32(8,!0),n.mask.maxValue=i.getFloat32(12,!0),s+=16,n.mask.numBytes>0){var o=new Uint8Array(Math.ceil(n.width*n.height/8));i=new DataView(r,s,n.mask.numBytes);var c=i.getInt16(0,!0),u=2,m=0;do{if(c>0)for(;c--;)o[m++]=i.getUint8(u++);else{var w=i.getUint8(u++);for(c=-c;c--;)o[m++]=w}c=i.getInt16(u,!0),u+=2}while(u<n.mask.numBytes);if(c!==-32768||m<o.length)throw"Unexpected end of mask RLE encoding";n.mask.bitset=o,s+=n.mask.numBytes}else(n.mask.numBytes|n.mask.numBlocksY|n.mask.maxValue)===0&&(n.mask.bitset=new Uint8Array(Math.ceil(n.width*n.height/8)));i=new DataView(r,s,16),n.pixels={},n.pixels.numBlocksY=i.getUint32(0,!0),n.pixels.numBlocksX=i.getUint32(4,!0),n.pixels.numBytes=i.getUint32(8,!0),n.pixels.maxValue=i.getFloat32(12,!0),s+=16;var l=n.pixels.numBlocksX,f=n.pixels.numBlocksY,g=l+(n.width%l>0?1:0),M=f+(n.height%f>0?1:0);n.pixels.blocks=new Array(g*M);for(var V=0,d=0;d<M;d++)for(var y=0;y<g;y++){var I=0,z=r.byteLength-s;i=new DataView(r,s,Math.min(10,z));var x={};n.pixels.blocks[V++]=x;var v=i.getUint8(0);if(I++,x.encoding=v&63,x.encoding>3)throw"Invalid block encoding ("+x.encoding+")";if(x.encoding===2){s++;continue}if(v!==0&&v!==2){if(v>>=6,x.offsetType=v,v===2)x.offset=i.getInt8(1),I++;else if(v===1)x.offset=i.getInt16(1,!0),I+=2;else if(v===0)x.offset=i.getFloat32(1,!0),I+=4;else throw"Invalid block offset type";if(x.encoding===1)if(v=i.getUint8(I),I++,x.bitsPerPixel=v&63,v>>=6,x.numValidPixelsType=v,v===2)x.numValidPixels=i.getUint8(I),I++;else if(v===1)x.numValidPixels=i.getUint16(I,!0),I+=2;else if(v===0)x.numValidPixels=i.getUint32(I,!0),I+=4;else throw"Invalid valid pixel count type"}if(s+=I,x.encoding!==3){var D,T;if(x.encoding===0){var S=(n.pixels.numBytes-1)/4;if(S!==Math.floor(S))throw"uncompressed block has invalid length";D=new ArrayBuffer(S*4),T=new Uint8Array(D),T.set(new Uint8Array(r,s,S*4));var B=new Float32Array(D);x.rawData=B,s+=S*4}else if(x.encoding===1){var L=Math.ceil(x.numValidPixels*x.bitsPerPixel/8),F=Math.ceil(L/4);D=new ArrayBuffer(F*4),T=new Uint8Array(D),T.set(new Uint8Array(r,s,L)),x.stuffedData=new Uint32Array(D),s+=L}}}return n.eofOffset=s,n},e=function(r,s,t,n,h,i,o){var c=(1<<s)-1,u=0,m,w=0,l,f,g=Math.ceil((o-n)/h),M=r.length*4-Math.ceil(s*t/8);for(r[r.length-1]<<=8*M,m=0;m<t;m++){if(w===0&&(f=r[u++],w=32),w>=s)l=f>>>w-s&c,w-=s;else{var V=s-w;l=(f&c)<<V&c,f=r[u++],w=32-V,l+=f>>>w}i[m]=l<g?n+l*h:o}return i};return A})(),re=(function(){var A={unstuff:function(a,e,r,s,t,n,h,i){var o=(1<<r)-1,c=0,u,m=0,w,l,f,g,M=a.length*4-Math.ceil(r*s/8);if(a[a.length-1]<<=8*M,t)for(u=0;u<s;u++)m===0&&(l=a[c++],m=32),m>=r?(w=l>>>m-r&o,m-=r):(f=r-m,w=(l&o)<<f&o,l=a[c++],m=32-f,w+=l>>>m),e[u]=t[w];else for(g=Math.ceil((i-n)/h),u=0;u<s;u++)m===0&&(l=a[c++],m=32),m>=r?(w=l>>>m-r&o,m-=r):(f=r-m,w=(l&o)<<f&o,l=a[c++],m=32-f,w+=l>>>m),e[u]=w<g?n+w*h:i},unstuffLUT:function(a,e,r,s,t,n){var h=(1<<e)-1,i=0,o=0,c=0,u=0,m=0,w,l=[],f=a.length*4-Math.ceil(e*r/8);a[a.length-1]<<=8*f;var g=Math.ceil((n-s)/t);for(o=0;o<r;o++)u===0&&(w=a[i++],u=32),u>=e?(m=w>>>u-e&h,u-=e):(c=e-u,m=(w&h)<<c&h,w=a[i++],u=32-c,m+=w>>>u),l[o]=m<g?s+m*t:n;return l.unshift(s),l},unstuff2:function(a,e,r,s,t,n,h,i){var o=(1<<r)-1,c=0,u,m=0,w=0,l,f,g;if(t)for(u=0;u<s;u++)m===0&&(f=a[c++],m=32,w=0),m>=r?(l=f>>>w&o,m-=r,w+=r):(g=r-m,l=f>>>w&o,f=a[c++],m=32-g,l|=(f&(1<<g)-1)<<r-g,w=g),e[u]=t[l];else{var M=Math.ceil((i-n)/h);for(u=0;u<s;u++)m===0&&(f=a[c++],m=32,w=0),m>=r?(l=f>>>w&o,m-=r,w+=r):(g=r-m,l=f>>>w&o,f=a[c++],m=32-g,l|=(f&(1<<g)-1)<<r-g,w=g),e[u]=l<M?n+l*h:i}return e},unstuffLUT2:function(a,e,r,s,t,n){var h=(1<<e)-1,i=0,o=0,c=0,u=0,m=0,w=0,l,f=[],g=Math.ceil((n-s)/t);for(o=0;o<r;o++)u===0&&(l=a[i++],u=32,w=0),u>=e?(m=l>>>w&h,u-=e,w+=e):(c=e-u,m=l>>>w&h,l=a[i++],u=32-c,m|=(l&(1<<c)-1)<<e-c,w=c),f[o]=m<g?s+m*t:n;return f.unshift(s),f},originalUnstuff:function(a,e,r,s){var t=(1<<r)-1,n=0,h,i=0,o,c,u,m=a.length*4-Math.ceil(r*s/8);for(a[a.length-1]<<=8*m,h=0;h<s;h++)i===0&&(c=a[n++],i=32),i>=r?(o=c>>>i-r&t,i-=r):(u=r-i,o=(c&t)<<u&t,c=a[n++],i=32-u,o+=c>>>i),e[h]=o;return e},originalUnstuff2:function(a,e,r,s){var t=(1<<r)-1,n=0,h,i=0,o=0,c,u,m;for(h=0;h<s;h++)i===0&&(u=a[n++],i=32,o=0),i>=r?(c=u>>>o&t,i-=r,o+=r):(m=r-i,c=u>>>o&t,u=a[n++],i=32-m,c|=(u&(1<<m)-1)<<r-m,o=m),e[h]=c;return e}},p={HUFFMAN_LUT_BITS_MAX:12,computeChecksumFletcher32:function(a){for(var e=65535,r=65535,s=a.length,t=Math.floor(s/2),n=0;t;){var h=t>=359?359:t;t-=h;do e+=a[n++]<<8,r+=e+=a[n++];while(--h);e=(e&65535)+(e>>>16),r=(r&65535)+(r>>>16)}return s&1&&(r+=e+=a[n]<<8),e=(e&65535)+(e>>>16),r=(r&65535)+(r>>>16),(r<<16|e)>>>0},readHeaderInfo:function(a,e){var r=e.ptr,s=new Uint8Array(a,r,6),t={};if(t.fileIdentifierString=String.fromCharCode.apply(null,s),t.fileIdentifierString.lastIndexOf("Lerc2",0)!==0)throw"Unexpected file identifier string (expect Lerc2 ): "+t.fileIdentifierString;r+=6;var n=new DataView(a,r,8),h=n.getInt32(0,!0);t.fileVersion=h,r+=4,h>=3&&(t.checksum=n.getUint32(4,!0),r+=4),n=new DataView(a,r,12),t.height=n.getUint32(0,!0),t.width=n.getUint32(4,!0),r+=8,h>=4?(t.numDims=n.getUint32(8,!0),r+=4):t.numDims=1,n=new DataView(a,r,40),t.numValidPixel=n.getUint32(0,!0),t.microBlockSize=n.getInt32(4,!0),t.blobSize=n.getInt32(8,!0),t.imageType=n.getInt32(12,!0),t.maxZError=n.getFloat64(16,!0),t.zMin=n.getFloat64(24,!0),t.zMax=n.getFloat64(32,!0),r+=40,e.headerInfo=t,e.ptr=r;var i,o;if(h>=3&&(o=h>=4?52:48,i=this.computeChecksumFletcher32(new Uint8Array(a,r-o,t.blobSize-14)),i!==t.checksum))throw"Checksum failed.";return!0},checkMinMaxRanges:function(a,e){var r=e.headerInfo,s=this.getDataTypeArray(r.imageType),t=r.numDims*this.getDataTypeSize(r.imageType),n=this.readSubArray(a,e.ptr,s,t),h=this.readSubArray(a,e.ptr+t,s,t);e.ptr+=2*t;var i,o=!0;for(i=0;i<r.numDims;i++)if(n[i]!==h[i]){o=!1;break}return r.minValues=n,r.maxValues=h,o},readSubArray:function(a,e,r,s){var t;if(r===Uint8Array)t=new Uint8Array(a,e,s);else{var n=new ArrayBuffer(s),h=new Uint8Array(n);h.set(new Uint8Array(a,e,s)),t=new r(n)}return t},readMask:function(a,e){var r=e.ptr,s=e.headerInfo,t=s.width*s.height,n=s.numValidPixel,h=new DataView(a,r,4),i={};if(i.numBytes=h.getUint32(0,!0),r+=4,(n===0||t===n)&&i.numBytes!==0)throw"invalid mask";var o,c;if(n===0)o=new Uint8Array(Math.ceil(t/8)),i.bitset=o,c=new Uint8Array(t),e.pixels.resultMask=c,r+=i.numBytes;else if(i.numBytes>0){o=new Uint8Array(Math.ceil(t/8)),h=new DataView(a,r,i.numBytes);var u=h.getInt16(0,!0),m=2,w=0,l=0;do{if(u>0)for(;u--;)o[w++]=h.getUint8(m++);else for(l=h.getUint8(m++),u=-u;u--;)o[w++]=l;u=h.getInt16(m,!0),m+=2}while(m<i.numBytes);if(u!==-32768||w<o.length)throw"Unexpected end of mask RLE encoding";c=new Uint8Array(t);var f=0,g=0;for(g=0;g<t;g++)g&7?(f=o[g>>3],f<<=g&7):f=o[g>>3],f&128&&(c[g]=1);e.pixels.resultMask=c,i.bitset=o,r+=i.numBytes}return e.ptr=r,e.mask=i,!0},readDataOneSweep:function(a,e,r,s){var t=e.ptr,n=e.headerInfo,h=n.numDims,i=n.width*n.height,o=n.imageType,c=n.numValidPixel*p.getDataTypeSize(o)*h,u,m=e.pixels.resultMask;if(r===Uint8Array)u=new Uint8Array(a,t,c);else{var w=new ArrayBuffer(c),l=new Uint8Array(w);l.set(new Uint8Array(a,t,c)),u=new r(w)}if(u.length===i*h)s?e.pixels.resultPixels=p.swapDimensionOrder(u,i,h,r,!0):e.pixels.resultPixels=u;else{e.pixels.resultPixels=new r(i*h);var f=0,g=0,M=0,V=0;if(h>1){if(s){for(g=0;g<i;g++)if(m[g])for(V=g,M=0;M<h;M++,V+=i)e.pixels.resultPixels[V]=u[f++]}else for(g=0;g<i;g++)if(m[g])for(V=g*h,M=0;M<h;M++)e.pixels.resultPixels[V+M]=u[f++]}else for(g=0;g<i;g++)m[g]&&(e.pixels.resultPixels[g]=u[f++])}return t+=c,e.ptr=t,!0},readHuffmanTree:function(a,e){var r=this.HUFFMAN_LUT_BITS_MAX,s=new DataView(a,e.ptr,16);e.ptr+=16;var t=s.getInt32(0,!0);if(t<2)throw"unsupported Huffman version";var n=s.getInt32(4,!0),h=s.getInt32(8,!0),i=s.getInt32(12,!0);if(h>=i)return!1;var o=new Uint32Array(i-h);p.decodeBits(a,e,o);var c=[],u,m,w,l;for(u=h;u<i;u++)m=u-(u<n?0:n),c[m]={first:o[u-h],second:null};var f=a.byteLength-e.ptr,g=Math.ceil(f/4),M=new ArrayBuffer(g*4),V=new Uint8Array(M);V.set(new Uint8Array(a,e.ptr,f));var d=new Uint32Array(M),y=0,I,z=0;for(I=d[0],u=h;u<i;u++)m=u-(u<n?0:n),l=c[m].first,l>0&&(c[m].second=I<<y>>>32-l,32-y>=l?(y+=l,y===32&&(y=0,z++,I=d[z])):(y+=l-32,z++,I=d[z],c[m].second|=I>>>32-y));var x=0,v=0,D=new k;for(u=0;u<c.length;u++)c[u]!==void 0&&(x=Math.max(x,c[u].first));x>=r?v=r:v=x;var T=[],S,B,L,F,b,C;for(u=h;u<i;u++)if(m=u-(u<n?0:n),l=c[m].first,l>0)if(S=[l,m],l<=v)for(B=c[m].second<<v-l,L=1<<v-l,w=0;w<L;w++)T[B|w]=S;else for(B=c[m].second,C=D,F=l-1;F>=0;F--)b=B>>>F&1,b?(C.right||(C.right=new k),C=C.right):(C.left||(C.left=new k),C=C.left),F===0&&!C.val&&(C.val=S[1]);return{decodeLut:T,numBitsLUTQick:v,numBitsLUT:x,tree:D,stuffedData:d,srcPtr:z,bitPos:y}},readHuffman:function(a,e,r,s){var t=e.headerInfo,n=t.numDims,h=e.headerInfo.height,i=e.headerInfo.width,o=i*h,c=this.readHuffmanTree(a,e),u=c.decodeLut,m=c.tree,w=c.stuffedData,l=c.srcPtr,f=c.bitPos,g=c.numBitsLUTQick,M=c.numBitsLUT,V=e.headerInfo.imageType===0?128:0,d,y,I,z=e.pixels.resultMask,x,v,D,T,S,B,L,F=0;f>0&&(l++,f=0);var b=w[l],C=e.encodeMode===1,R=new r(o*n),O=R,X;if(n<2||C){for(X=0;X<n;X++)if(n>1&&(O=new r(R.buffer,o*X,o),F=0),e.headerInfo.numValidPixel===i*h)for(B=0,T=0;T<h;T++)for(S=0;S<i;S++,B++){if(y=0,x=b<<f>>>32-g,v=x,32-f<g&&(x|=w[l+1]>>>64-f-g,v=x),u[v])y=u[v][1],f+=u[v][0];else for(x=b<<f>>>32-M,v=x,32-f<M&&(x|=w[l+1]>>>64-f-M,v=x),d=m,L=0;L<M;L++)if(D=x>>>M-L-1&1,d=D?d.right:d.left,!(d.left||d.right)){y=d.val,f=f+L+1;break}f>=32&&(f-=32,l++,b=w[l]),I=y-V,C?(S>0?I+=F:T>0?I+=O[B-i]:I+=F,I&=255,O[B]=I,F=I):O[B]=I}else for(B=0,T=0;T<h;T++)for(S=0;S<i;S++,B++)if(z[B]){if(y=0,x=b<<f>>>32-g,v=x,32-f<g&&(x|=w[l+1]>>>64-f-g,v=x),u[v])y=u[v][1],f+=u[v][0];else for(x=b<<f>>>32-M,v=x,32-f<M&&(x|=w[l+1]>>>64-f-M,v=x),d=m,L=0;L<M;L++)if(D=x>>>M-L-1&1,d=D?d.right:d.left,!(d.left||d.right)){y=d.val,f=f+L+1;break}f>=32&&(f-=32,l++,b=w[l]),I=y-V,C?(S>0&&z[B-1]?I+=F:T>0&&z[B-i]?I+=O[B-i]:I+=F,I&=255,O[B]=I,F=I):O[B]=I}}else for(B=0,T=0;T<h;T++)for(S=0;S<i;S++)if(B=T*i+S,!z||z[B])for(X=0;X<n;X++,B+=o){if(y=0,x=b<<f>>>32-g,v=x,32-f<g&&(x|=w[l+1]>>>64-f-g,v=x),u[v])y=u[v][1],f+=u[v][0];else for(x=b<<f>>>32-M,v=x,32-f<M&&(x|=w[l+1]>>>64-f-M,v=x),d=m,L=0;L<M;L++)if(D=x>>>M-L-1&1,d=D?d.right:d.left,!(d.left||d.right)){y=d.val,f=f+L+1;break}f>=32&&(f-=32,l++,b=w[l]),I=y-V,O[B]=I}e.ptr=e.ptr+(l+1)*4+(f>0?4:0),e.pixels.resultPixels=R,n>1&&!s&&(e.pixels.resultPixels=p.swapDimensionOrder(R,o,n,r))},decodeBits:function(a,e,r,s,t){{var n=e.headerInfo,h=n.fileVersion,i=0,o=a.byteLength-e.ptr>=5?5:a.byteLength-e.ptr,c=new DataView(a,e.ptr,o),u=c.getUint8(0);i++;var m=u>>6,w=m===0?4:3-m,l=(u&32)>0,f=u&31,g=0;if(w===1)g=c.getUint8(i),i++;else if(w===2)g=c.getUint16(i,!0),i+=2;else if(w===4)g=c.getUint32(i,!0),i+=4;else throw"Invalid valid pixel count type";var M=2*n.maxZError,V,d,y,I,z,x,v,D,T,S=n.numDims>1?n.maxValues[t]:n.zMax;if(l){for(e.counter.lut++,D=c.getUint8(i),i++,I=Math.ceil((D-1)*f/8),z=Math.ceil(I/4),d=new ArrayBuffer(z*4),y=new Uint8Array(d),e.ptr+=i,y.set(new Uint8Array(a,e.ptr,I)),v=new Uint32Array(d),e.ptr+=I,T=0;D-1>>>T;)T++;I=Math.ceil(g*T/8),z=Math.ceil(I/4),d=new ArrayBuffer(z*4),y=new Uint8Array(d),y.set(new Uint8Array(a,e.ptr,I)),V=new Uint32Array(d),e.ptr+=I,h>=3?x=A.unstuffLUT2(v,f,D-1,s,M,S):x=A.unstuffLUT(v,f,D-1,s,M,S),h>=3?A.unstuff2(V,r,T,g,x):A.unstuff(V,r,T,g,x)}else e.counter.bitstuffer++,T=f,e.ptr+=i,T>0&&(I=Math.ceil(g*T/8),z=Math.ceil(I/4),d=new ArrayBuffer(z*4),y=new Uint8Array(d),y.set(new Uint8Array(a,e.ptr,I)),V=new Uint32Array(d),e.ptr+=I,h>=3?s==null?A.originalUnstuff2(V,r,T,g):A.unstuff2(V,r,T,g,!1,s,M,S):s==null?A.originalUnstuff(V,r,T,g):A.unstuff(V,r,T,g,!1,s,M,S))}},readTiles:function(a,e,r,s){var t=e.headerInfo,n=t.width,h=t.height,i=n*h,o=t.microBlockSize,c=t.imageType,u=p.getDataTypeSize(c),m=Math.ceil(n/o),w=Math.ceil(h/o);e.pixels.numBlocksY=w,e.pixels.numBlocksX=m,e.pixels.ptr=0;var l=0,f=0,g=0,M=0,V=0,d=0,y=0,I=0,z=0,x=0,v=0,D=0,T=0,S=0,B=0,L=0,F,b,C,R,O,X,G=new r(o*o),le=h%o||o,ue=n%o||o,K,Q,J=t.numDims,$,E=e.pixels.resultMask,Y=e.pixels.resultPixels,he=t.fileVersion,P=he>=5?14:15,_,W=t.zMax,H;for(g=0;g<w;g++)for(V=g!==w-1?o:le,M=0;M<m;M++)for(d=M!==m-1?o:ue,v=g*n*o+M*o,D=n-d,$=0;$<J;$++){if(J>1?(H=Y,v=g*n*o+M*o,Y=new r(e.pixels.resultPixels.buffer,i*$*u,i),W=t.maxValues[$]):H=null,y=a.byteLength-e.ptr,F=new DataView(a,e.ptr,Math.min(10,y)),b={},L=0,I=F.getUint8(0),L++,_=t.fileVersion>=5?I&4:0,z=I>>6&255,x=I>>2&P,x!==(M*o>>3&P)||_&&$===0)throw"integrity issue";if(X=I&3,X>3)throw e.ptr+=L,"Invalid block encoding ("+X+")";if(X===2){if(_)if(E)for(l=0;l<V;l++)for(f=0;f<d;f++)E[v]&&(Y[v]=H[v]),v++;else for(l=0;l<V;l++)for(f=0;f<d;f++)Y[v]=H[v],v++;e.counter.constant++,e.ptr+=L;continue}else if(X===0){if(_)throw"integrity issue";if(e.counter.uncompressed++,e.ptr+=L,T=V*d*u,S=a.byteLength-e.ptr,T=T<S?T:S,C=new ArrayBuffer(T%u===0?T:T+u-T%u),R=new Uint8Array(C),R.set(new Uint8Array(a,e.ptr,T)),O=new r(C),B=0,E)for(l=0;l<V;l++){for(f=0;f<d;f++)E[v]&&(Y[v]=O[B++]),v++;v+=D}else for(l=0;l<V;l++){for(f=0;f<d;f++)Y[v++]=O[B++];v+=D}e.ptr+=B*u}else if(K=p.getDataTypeUsed(_&&c<6?4:c,z),Q=p.getOnePixel(b,L,K,F),L+=p.getDataTypeSize(K),X===3)if(e.ptr+=L,e.counter.constantoffset++,E)for(l=0;l<V;l++){for(f=0;f<d;f++)E[v]&&(Y[v]=_?Math.min(W,H[v]+Q):Q),v++;v+=D}else for(l=0;l<V;l++){for(f=0;f<d;f++)Y[v]=_?Math.min(W,H[v]+Q):Q,v++;v+=D}else if(e.ptr+=L,p.decodeBits(a,e,G,Q,$),L=0,_)if(E)for(l=0;l<V;l++){for(f=0;f<d;f++)E[v]&&(Y[v]=G[L++]+H[v]),v++;v+=D}else for(l=0;l<V;l++){for(f=0;f<d;f++)Y[v]=G[L++]+H[v],v++;v+=D}else if(E)for(l=0;l<V;l++){for(f=0;f<d;f++)E[v]&&(Y[v]=G[L++]),v++;v+=D}else for(l=0;l<V;l++){for(f=0;f<d;f++)Y[v++]=G[L++];v+=D}}J>1&&!s&&(e.pixels.resultPixels=p.swapDimensionOrder(e.pixels.resultPixels,i,J,r))},formatFileInfo:function(a){return{fileIdentifierString:a.headerInfo.fileIdentifierString,fileVersion:a.headerInfo.fileVersion,imageType:a.headerInfo.imageType,height:a.headerInfo.height,width:a.headerInfo.width,numValidPixel:a.headerInfo.numValidPixel,microBlockSize:a.headerInfo.microBlockSize,blobSize:a.headerInfo.blobSize,maxZError:a.headerInfo.maxZError,pixelType:p.getPixelType(a.headerInfo.imageType),eofOffset:a.eofOffset,mask:a.mask?{numBytes:a.mask.numBytes}:null,pixels:{numBlocksX:a.pixels.numBlocksX,numBlocksY:a.pixels.numBlocksY,maxValue:a.headerInfo.zMax,minValue:a.headerInfo.zMin,noDataValue:a.noDataValue}}},constructConstantSurface:function(a,e){var r=a.headerInfo.zMax,s=a.headerInfo.zMin,t=a.headerInfo.maxValues,n=a.headerInfo.numDims,h=a.headerInfo.height*a.headerInfo.width,i=0,o=0,c=0,u=a.pixels.resultMask,m=a.pixels.resultPixels;if(u)if(n>1){if(e)for(i=0;i<n;i++)for(c=i*h,r=t[i],o=0;o<h;o++)u[o]&&(m[c+o]=r);else for(o=0;o<h;o++)if(u[o])for(c=o*n,i=0;i<n;i++)m[c+n]=t[i]}else for(o=0;o<h;o++)u[o]&&(m[o]=r);else if(n>1&&s!==r)if(e)for(i=0;i<n;i++)for(c=i*h,r=t[i],o=0;o<h;o++)m[c+o]=r;else for(o=0;o<h;o++)for(c=o*n,i=0;i<n;i++)m[c+i]=t[i];else for(o=0;o<h*n;o++)m[o]=r},getDataTypeArray:function(a){var e;switch(a){case 0:e=Int8Array;break;case 1:e=Uint8Array;break;case 2:e=Int16Array;break;case 3:e=Uint16Array;break;case 4:e=Int32Array;break;case 5:e=Uint32Array;break;case 6:e=Float32Array;break;case 7:e=Float64Array;break;default:e=Float32Array}return e},getPixelType:function(a){var e;switch(a){case 0:e="S8";break;case 1:e="U8";break;case 2:e="S16";break;case 3:e="U16";break;case 4:e="S32";break;case 5:e="U32";break;case 6:e="F32";break;case 7:e="F64";break;default:e="F32"}return e},isValidPixelValue:function(a,e){if(e==null)return!1;var r;switch(a){case 0:r=e>=-128&&e<=127;break;case 1:r=e>=0&&e<=255;break;case 2:r=e>=-32768&&e<=32767;break;case 3:r=e>=0&&e<=65536;break;case 4:r=e>=-2147483648&&e<=2147483647;break;case 5:r=e>=0&&e<=4294967296;break;case 6:r=e>=-34027999387901484e22&&e<=34027999387901484e22;break;case 7:r=e>=-17976931348623157e292&&e<=17976931348623157e292;break;default:r=!1}return r},getDataTypeSize:function(a){var e=0;switch(a){case 0:case 1:e=1;break;case 2:case 3:e=2;break;case 4:case 5:case 6:e=4;break;case 7:e=8;break;default:e=a}return e},getDataTypeUsed:function(a,e){var r=a;switch(a){case 2:case 4:r=a-e;break;case 3:case 5:r=a-2*e;break;case 6:e===0?r=a:e===1?r=2:r=1;break;case 7:e===0?r=a:r=a-2*e+1;break;default:r=a;break}return r},getOnePixel:function(a,e,r,s){var t=0;switch(r){case 0:t=s.getInt8(e);break;case 1:t=s.getUint8(e);break;case 2:t=s.getInt16(e,!0);break;case 3:t=s.getUint16(e,!0);break;case 4:t=s.getInt32(e,!0);break;case 5:t=s.getUInt32(e,!0);break;case 6:t=s.getFloat32(e,!0);break;case 7:t=s.getFloat64(e,!0);break;default:throw"the decoder does not understand this pixel type"}return t},swapDimensionOrder:function(a,e,r,s,t){var n=0,h=0,i=0,o=0,c=a;if(r>1)if(c=new s(e*r),t)for(n=0;n<e;n++)for(o=n,i=0;i<r;i++,o+=e)c[o]=a[h++];else for(n=0;n<e;n++)for(o=n,i=0;i<r;i++,o+=e)c[h++]=a[o];return c}},k=function(a,e,r){this.val=a,this.left=e,this.right=r},U={decode:function(a,e){e=e||{};var r=e.noDataValue,s=0,t={};if(t.ptr=e.inputOffset||0,t.pixels={},!!p.readHeaderInfo(a,t)){var n=t.headerInfo,h=n.fileVersion,i=p.getDataTypeArray(n.imageType);if(h>5)throw"unsupported lerc version 2."+h;p.readMask(a,t),n.numValidPixel!==n.width*n.height&&!t.pixels.resultMask&&(t.pixels.resultMask=e.maskData);var o=n.width*n.height;t.pixels.resultPixels=new i(o*n.numDims),t.counter={onesweep:0,uncompressed:0,lut:0,bitstuffer:0,constant:0,constantoffset:0};var c=!e.returnPixelInterleavedDims;if(n.numValidPixel!==0)if(n.zMax===n.zMin)p.constructConstantSurface(t,c);else if(h>=4&&p.checkMinMaxRanges(a,t))p.constructConstantSurface(t,c);else{var u=new DataView(a,t.ptr,2),m=u.getUint8(0);if(t.ptr++,m)p.readDataOneSweep(a,t,i,c);else if(h>1&&n.imageType<=1&&Math.abs(n.maxZError-.5)<1e-5){var w=u.getUint8(1);if(t.ptr++,t.encodeMode=w,w>2||h<4&&w>1)throw"Invalid Huffman flag "+w;w?p.readHuffman(a,t,i,c):p.readTiles(a,t,i,c)}else p.readTiles(a,t,i,c)}t.eofOffset=t.ptr;var l;e.inputOffset?(l=t.headerInfo.blobSize+e.inputOffset-t.ptr,Math.abs(l)>=1&&(t.eofOffset=e.inputOffset+t.headerInfo.blobSize)):(l=t.headerInfo.blobSize-t.ptr,Math.abs(l)>=1&&(t.eofOffset=t.headerInfo.blobSize));var f={width:n.width,height:n.height,pixelData:t.pixels.resultPixels,minValue:n.zMin,maxValue:n.zMax,validPixelCount:n.numValidPixel,dimCount:n.numDims,dimStats:{minValues:n.minValues,maxValues:n.maxValues},maskData:t.pixels.resultMask};if(t.pixels.resultMask&&p.isValidPixelValue(n.imageType,r)){var g=t.pixels.resultMask;for(s=0;s<o;s++)g[s]||(f.pixelData[s]=r);f.noDataValue=r}return t.noDataValue=r,e.returnFileInfo&&(f.fileInfo=p.formatFileInfo(t)),f}},getBandCount:function(a){var e=0,r=0,s={};for(s.ptr=0,s.pixels={};r<a.byteLength-58;)p.readHeaderInfo(a,s),r+=s.headerInfo.blobSize,e++,s.ptr=r;return e}};return U})();var ne=(function(){var A=new ArrayBuffer(4),p=new Uint8Array(A),k=new Uint32Array(A);return k[0]=1,p[0]===1})(),ie={decode:function(A,p){if(!ne)throw"Big endian system is not supported.";p=p||{};var k=p.inputOffset||0,U=new Uint8Array(A,k,10),a=String.fromCharCode.apply(null,U),e,r;if(a.trim()==="CntZImage")e=ee,r=1;else if(a.substring(0,5)==="Lerc2")e=re,r=2;else throw"Unexpected file identifier string: "+a;for(var s=0,t=A.byteLength-10,n,h=[],i,o,c={width:0,height:0,pixels:[],pixelType:p.pixelType,mask:null,statistics:[]},u=0;k<t;){var m=e.decode(A,{inputOffset:k,encodedMaskData:n,maskData:o,returnMask:s===0,returnEncodedMask:s===0,returnFileInfo:!0,returnPixelInterleavedDims:p.returnPixelInterleavedDims,pixelType:p.pixelType||null,noDataValue:p.noDataValue||null});k=m.fileInfo.eofOffset,o=m.maskData,s===0&&(n=m.encodedMaskData,c.width=m.width,c.height=m.height,c.dimCount=m.dimCount||1,c.pixelType=m.pixelType||m.fileInfo.pixelType,c.mask=o),r>1&&(o&&h.push(o),m.fileInfo.mask&&m.fileInfo.mask.numBytes>0&&u++),s++,c.pixels.push(m.pixelData),c.statistics.push({minValue:m.minValue,maxValue:m.maxValue,noDataValue:m.noDataValue,dimStats:m.dimStats})}var w,l,f;if(r>1&&u>1){for(f=c.width*c.height,c.bandMasks=h,o=new Uint8Array(f),o.set(h[0]),w=1;w<h.length;w++)for(i=h[w],l=0;l<f;l++)o[l]=o[l]&i[l];c.maskData=o}return c}};const te={0:7e3,1:6e3,2:5e3,3:4e3,4:3e3,5:2500,6:2e3,7:1500,8:800,9:500,10:200,11:100,12:40,13:12,14:5,15:2,16:1,17:.5,18:.2,19:.1,20:.01};function ae(A){const{height:p,width:k,pixels:U}=ie.decode(A),a=new Float32Array(p*k);for(let e=0;e<a.length;e++)a[e]=U[0][e];return{array:a,width:k,height:p}}function se(A,p,k){let U=ae(A);k[2]-k[0]<1&&(U=fe(U,k));const{array:a,width:e}=U,s=new Z(e).createTile(a),t=te[p]||0;return s.getGeometryData(t)}function fe(A,p){function k(s,t,n,h,i,o,c,u){const m=new Float32Array(i*o);for(let l=0;l<o;l++)for(let f=0;f<i;f++){const g=(l+h)*t+(f+n),M=l*i+f;m[M]=s[g]}const w=new Float32Array(u*c);for(let l=0;l<u;l++)for(let f=0;f<c;f++){const g=l*u+f,M=Math.round(f*o/u),d=Math.round(l*i/c)*i+M;w[g]=m[d]}return w}const U=oe(p,A.width),a=U.sw+1,e=U.sh+1;return{array:k(A.array,A.width,U.sx,U.sy,U.sw,U.sh,a,e),width:a,height:e}}function oe(A,p){const k=Math.floor(A[0]*p),U=Math.floor(A[1]*p),a=Math.floor((A[2]-A[0])*p),e=Math.floor((A[3]-A[1])*p);return{sx:k,sy:U,sw:a,sh:e}}self.onmessage=A=>{const p=A.data,k=se(p.demData,p.z,p.clipBounds);self.postMessage(k)}})();\n', he = typeof self < "u" && self.Blob && new Blob([Ie], { type: "text/javascript;charset=utf-8" });
function It(o) {
  let t;
  try {
    if (t = he && (self.URL || self.webkitURL).createObjectURL(he), !t) throw "";
    const e = new Worker(t, {
      name: o?.name
    });
    return e.addEventListener("error", () => {
      (self.URL || self.webkitURL).revokeObjectURL(t);
    }), e;
  } catch {
    return new Worker(
      "data:text/javascript;charset=utf-8," + encodeURIComponent(Ie),
      {
        name: o?.name
      }
    );
  } finally {
    t && (self.URL || self.webkitURL).revokeObjectURL(t);
  }
}
const Tt = 5;
class Ut extends te {
  constructor() {
    super();
    u(this, "info", {
      version: z,
      description: "Tile LERC terrain loader. It can load ArcGis-lerc format terrain data."
    });
    u(this, "dataType", "lerc");
    // 图像加载器
    u(this, "fileLoader", new Ne(y.manager));
    u(this, "_workerPool", new ve(0));
    this.fileLoader.setResponseType("arraybuffer"), this._workerPool.setWorkerCreator(() => new It());
  }
  /**
   * 异步加载并解析数据，返回BufferGeometry对象
   *
   * @param url 数据文件的URL
   * @param params 解析参数，包含瓦片xyz和裁剪边界clipBounds
   * @returns 返回解析后的BufferGeometry对象
   */
  async doLoad(e, r) {
    this._workerPool.pool === 0 && this._workerPool.setWorkerLimit(Tt);
    const { z: n, clipBounds: i } = r, s = {
      demData: await this.fileLoader.loadAsync(e),
      z: n,
      clipBounds: i
    }, l = (await this._workerPool.postMessage(s)).data;
    return new F().setData(l);
  }
}
re(new Ut());
const Te = `(function(){"use strict";function c(t){return a(t.data)}function a(t){function n(e,u){const r=u*4,[i,f,g,l]=e.slice(r,r+4);return l===0?0:-1e4+(i<<16|f<<8|g)*.1}const o=t.length>>>2,s=new Float32Array(o);for(let e=0;e<o;e++)s[e]=n(t,e);return s}self.onmessage=t=>{const n=c(t.data.imgData);self.postMessage(n)}})();
`, fe = typeof self < "u" && self.Blob && new Blob([Te], { type: "text/javascript;charset=utf-8" });
function St(o) {
  let t;
  try {
    if (t = fe && (self.URL || self.webkitURL).createObjectURL(fe), !t) throw "";
    const e = new Worker(t, {
      name: o?.name
    });
    return e.addEventListener("error", () => {
      (self.URL || self.webkitURL).revokeObjectURL(t);
    }), e;
  } catch {
    return new Worker(
      "data:text/javascript;charset=utf-8," + encodeURIComponent(Te),
      {
        name: o?.name
      }
    );
  } finally {
    t && (self.URL || self.webkitURL).revokeObjectURL(t);
  }
}
const At = 10;
class Dt extends te {
  constructor() {
    super();
    u(this, "info", {
      version: z,
      description: "Mapbox-RGB terrain loader, It can load Mapbox-RGB terrain data."
    });
    // 数据类型标识
    u(this, "dataType", "terrain-rgb");
    // 使用imageLoader下载
    u(this, "imageLoader", new K(y.manager));
    u(this, "_workerPool", new ve(0));
    this._workerPool.setWorkerCreator(() => new St());
  }
  // 下载数据
  /**
   * 异步加载BufferGeometry对象
   *
   * @param url 图片的URL地址
   * @param params 加载参数，包含瓦片xyz和裁剪边界clipBounds
   * @returns 返回解析后的BufferGeometry对象
   */
  async doLoad(e, r) {
    const n = await this.imageLoader.loadAsync(e), { clipBounds: i, z: a } = r, s = qe.clamp((a + 2) * 3, 2, 64), l = _t(n, i, s);
    let c;
    this._workerPool.pool === 0 && this._workerPool.setWorkerLimit(At), c = (await this._workerPool.postMessage({ imgData: l }, [l.data.buffer])).data;
    const h = new F();
    return h.setData(c), h;
  }
}
function _t(o, t, e) {
  const r = ee(t, o.width);
  e = Math.min(e, r.sw);
  const i = new OffscreenCanvas(e, e).getContext("2d");
  return i.imageSmoothingEnabled = !1, i.drawImage(o, r.sx, r.sy, r.sw, r.sh, 0, 0, e, e), i.getImageData(0, 0, e, e);
}
re(new Dt());
class Bt extends te {
  constructor() {
    super(...arguments);
    u(this, "info", {
      version: z,
      description: "Terrarium shader loader — uploads raw PNG for GPU decode via TSL positionNode."
    });
    u(this, "dataType", "terrarium-shader");
    u(this, "imageLoader", new K(y.manager));
  }
  async doLoad(e, r) {
    const n = await this.imageLoader.loadAsync(e), { clipBounds: i, z: a } = r, s = Math.min(Math.max((a + 2) * 4, 16), 128), l = ee(i, n.width), c = new OffscreenCanvas(s, s), h = c.getContext("2d");
    h.imageSmoothingEnabled = !1, h.drawImage(n, l.sx, l.sy, l.sw, l.sh, 0, 0, s, s);
    const d = new J(c);
    d.colorSpace = "", d.generateMipmaps = !1, d.magFilter = ie, d.minFilter = ie, d.needsUpdate = !0;
    const f = zt(s);
    return f.userData.heightTexture = d, f;
  }
}
function zt(o) {
  const t = new Float32Array(o * o), e = new F();
  return e.setData(t, 1e3), e;
}
re(new Bt());
const me = [
  "#ff6666",
  "#66ff66",
  "#6666ff",
  "#ffff66",
  "#ff66ff",
  "#66ffff",
  "#ff9933",
  "#9933ff",
  "#33ff99",
  "#ff3399",
  "#3399ff",
  "#99ff33",
  "#cc6600",
  "#0066cc",
  "#66cc00",
  "#cc0066",
  "#00cc66",
  "#6600cc",
  "#ff4444",
  "#44ff44"
];
class Vt extends kt {
  constructor() {
    super(...arguments);
    u(this, "dataType", "debug");
  }
  drawTile(e, r) {
    const { x: n, y: i, z: a } = r, s = e.canvas.width, l = e.canvas.height, c = me[a % me.length];
    e.fillStyle = c, e.globalAlpha = 0.4, e.fillRect(0, 0, s, l), e.globalAlpha = 1, e.strokeStyle = "#000", e.lineWidth = 2, e.strokeRect(1, 1, s - 2, l - 2), e.fillStyle = "#000", e.font = "bold 28px monospace", e.textAlign = "center", e.textBaseline = "middle", e.fillText(`Z${a}`, s / 2, l / 2 - 30), e.fillText(`X${n}  Y${i}`, s / 2, l / 2 + 10), e.strokeStyle = "rgba(0,0,0,0.3)", e.lineWidth = 1, e.beginPath(), e.moveTo(s / 2, 0), e.lineTo(s / 2, l), e.moveTo(0, l / 2), e.lineTo(s, l / 2), e.stroke();
  }
}
Be(new Vt());
class Ue {
  /**
   * constructor
   * @param options SourceOptions
   */
  constructor(t) {
    /** Data type that determines which loader to use for loading and processing data. Default is "image" type */
    u(this, "dataType", "image");
    /** Copyright attribution information for the data source, used for displaying map copyright notices */
    u(this, "attribution", "ThreeTile");
    /** Minimum zoom level supported by the data source. Default is 0 */
    u(this, "minLevel", 0);
    /** Maximum zoom level supported by the data source. Default is 18 */
    u(this, "maxLevel", 18);
    /** Data projection type. Default is "3857" Mercator projection */
    u(this, "projectionID", "3857");
    /** URL template for tile data. Uses variables like {x},{y},{z} to construct tile request URLs */
    u(this, "url", "");
    /** List of URL subdomains for load balancing. Can be an array of strings or a single string */
    u(this, "subdomains", []);
    /** material opacity. Range 0-1, default is 1.0 (completely opaque) */
    u(this, "opacity", 1);
    /** Whether the material is transparent. Default is true (transparent) */
    u(this, "transparent", !0);
    /** Whether to use TMS tile coordinate system. Default false uses XYZ system, true uses TMS system */
    u(this, "isTMS", !1);
    /** Data bounds in format [minLon, minLat, maxLon, maxLat]. Default is undefined */
    u(this, "bounds");
    // = [-180, -85, 180, 85];
    /** Projected data bounds */
    u(this, "_projectionBounds", [-1 / 0, -1 / 0, 1 / 0, 1 / 0]);
    Object.assign(this, t);
  }
  _getBBox(t, e, r) {
    const n = Math.PI * 6378137, i = 2 * n / Math.pow(2, r), a = -n + t * i, s = n - (e + 1) * i, l = -n + (t + 1) * i, c = n - e * i;
    return `${a},${s},${l},${c}`;
  }
  /**
   * Get url from tile coordinate, public, overwrite to custom generation tile url from xyz
   * @param x tile x coordinate
   * @param y tile y coordinate
   * @param z tile z coordinate
   * @returns url tile url
   */
  getUrl(t, e, r, n) {
    const i = this.subdomains.length;
    let a;
    if (i > 0) {
      const c = Math.floor(Math.random() * i);
      a = this.subdomains[c];
    }
    const s = this._getBBox(t, e, r);
    e = this.isTMS ? Math.pow(2, r) - 1 - e : e;
    const l = { ...this, x: t, y: e, z: r, s: a, bbox: s, ...n };
    return Pt(this.url, l);
  }
  /**
   * Get url from tile coordinate, public，called by TileLoader
   * @param x tile x coordinate
   * @param y tile y coordinate
   * @param z tile z coordinate
   * @returns url tile url
   */
  // public _getUrl(x: number, y: number, z: number): string | undefined {
  // 	// reverse y coordinate if TMS scheme
  // 	const reverseY = this.isTMS ? Math.pow(2, z) - 1 - y : y;
  // 	return this.getUrl(x, reverseY, z);
  // }
  /**
   * Create source directly through factoy functions.
   * @param options source options
   * @returns ISource data source instance
   */
  static create(t) {
    return new Ue(t);
  }
}
function Pt(o, t) {
  const e = /\{ *([\w_-]+) *\}/g;
  return o.replace(e, (r, n) => {
    const i = t[n] ?? (() => {
      throw new Error(`source url template error, No value provided for variable: ${r}`);
    })();
    return typeof i == "function" ? i(t) : i;
  });
}
class Se {
  /**
   * 构造函数
   * @param centerLon 中央经线
   */
  constructor(t = 0) {
    u(this, "_lon0", 0);
    this._lon0 = t;
  }
  /** 中央经线 */
  get lon0() {
    return this._lon0;
  }
  /**
   * 根据中央经线取得变换后的瓦片X坐标
   * @param x
   * @param z
   * @returns
   */
  getTileXWithCenterLon(t, e) {
    const r = Math.pow(2, e);
    let n = t + Math.round(r / 360 * this._lon0);
    return n >= r ? n -= r : n < 0 && (n += r), n;
  }
  /**
   * 取得瓦片左下角投影坐标
   * @param x
   * @param y
   * @param z
   * @returns
   */
  // private getTileXYZproj(x: number, y: number, z: number) {
  // 	const w = this.mapWidth;
  // 	const h = this.mapHeight / 2;
  // 	const px = (x / Math.pow(2, z)) * w - w / 2;
  // 	const py = h - (y / Math.pow(2, z)) * h * 2;
  // 	return { x: px, y: py };
  // }
  /**
   * 取得经纬度范围的投影坐标
   * @param bounds 经纬度边界
   * @returns 投影坐标
   */
  getProjBoundsFromLonLat(t) {
    const e = t[2] - t[0] > 180, r = this.project(t[0] + (e ? this._lon0 : 0), t[1]), n = this.project(t[2] + (e ? this._lon0 : 0), t[3]);
    return [Math.min(r.x, n.x), Math.min(r.y, n.y), Math.max(r.x, n.x), Math.max(r.y, n.y)];
  }
  /**
  	 * 取得瓦片边界投影坐标范围
  
  	 * @param x 瓦片X坐标
  	 * @param y 瓦片Y坐标
  	 * @param z  瓦片层级
  	 * @returns 
  	 */
  getProjBoundsFromXYZ(t, e, r) {
    const n = Math.PI * 6378137, i = 2 * n / Math.pow(2, r), a = -n + t * i, s = n - (e + 1) * i, l = -n + (t + 1) * i, c = n - e * i;
    return [a, s, l, c];
  }
  getLonLatBoundsFromXYZ(t, e, r) {
    const n = this.getProjBoundsFromXYZ(t, e, r), i = this.unProject(n[0], n[1]), a = this.unProject(n[2], n[3]);
    return [i.lon, i.lat, a.lon, a.lat];
  }
}
const E = 6378137;
class Ae extends Se {
  constructor() {
    super(...arguments);
    u(this, "ID", "3857");
    // projeciton ID
    u(this, "mapWidth", 2 * Math.PI * E);
    //E-W scacle Earth's circumference(m)
    u(this, "mapHeight", this.mapWidth);
    //S-N scacle Earth's circumference(m)
    u(this, "mapDepth", 1);
  }
  //Height scale
  /**
   * Latitude and longitude to projected coordinates
   * @param lon longitude
   * @param lat Latitude
   * @returns projected coordinates
   */
  project(e, r) {
    const n = (e - this.lon0) * (Math.PI / 180), i = r * (Math.PI / 180), a = E * n, s = E * Math.log(Math.tan(Math.PI / 4 + i / 2));
    return { x: a, y: s };
  }
  /**
   * Projected coordinates to latitude and longitude
   * @param x projection x
   * @param y projection y
   * @returns latitude and longitude
   */
  unProject(e, r) {
    let n = e / E * (180 / Math.PI) + this.lon0;
    return n > 180 && (n -= 360), { lat: (2 * Math.atan(Math.exp(r / E)) - Math.PI / 2) * (180 / Math.PI), lon: n };
  }
}
class Ft extends Se {
  constructor() {
    super(...arguments);
    u(this, "ID", "4326");
    u(this, "mapWidth", 36e3 * 1e3);
    //E-W scacle (*0.01°)
    u(this, "mapHeight", 18e3 * 1e3);
    //S-N scale (*0.01°)
    u(this, "mapDepth", 1);
  }
  //height scale
  project(e, r) {
    return { x: (e - this.lon0) * 100 * 1e3, y: r * 100 * 1e3 };
  }
  unProject(e, r) {
    return { lon: e / (100 * 1e3) + this.lon0, lat: r / (100 * 1e3) };
  }
}
const ge = {
  /**
   * create projection object from projection ID
   *
   * @param id projeciton ID, default: "3857"
   * @returns IProjection instance
   */
  createFromID: (o = "3857", t) => {
    let e;
    switch (o) {
      case "3857":
        e = new Ae(t);
        break;
      case "4326":
        e = new Ft(t);
        break;
      default:
        throw new Error(`Projection ID: ${o} is not supported.`);
    }
    return e;
  }
};
class Ct extends Q {
  constructor() {
    super(...arguments);
    u(this, "_projection", new Ae(0));
  }
  get imgSource() {
    return super.imgSource;
  }
  set imgSource(e) {
    super.imgSource = e, this._updateImgProjBounds();
  }
  get demSource() {
    return super.demSource;
  }
  set demSource(e) {
    super.demSource = e, this._updateDemPrjBounds();
  }
  _updateImgProjBounds() {
    const e = this._projection;
    this.imgSource.forEach((r) => {
      r._projectionBounds = e.getProjBoundsFromLonLat(r.bounds || this.bounds);
    });
  }
  _updateDemPrjBounds() {
    const e = this._projection;
    this.demSource && (this.demSource._projectionBounds = e.getProjBoundsFromLonLat(this.demSource.bounds || this.bounds));
  }
  get projection() {
    return this._projection;
  }
  set projection(e) {
    this._projection = e, this._updateImgProjBounds(), this._updateDemPrjBounds();
  }
  async load(e) {
    const { x: r, y: n, z: i, bounds: a, lonLatBounds: s } = this.getTileCoords(e);
    return super.load({ x: r, y: n, z: i, bounds: a, lonLatBounds: s });
  }
  async update(e, r, n, i) {
    const { x: a, y: s, z: l, bounds: c, lonLatBounds: h } = this.getTileCoords(r);
    return await super.update(e, { x: a, y: s, z: l, bounds: c, lonLatBounds: h }, n, i);
  }
  getTileCoords(e) {
    if (!this._projection)
      throw new Error("projection is undefined");
    const { x: r, y: n, z: i } = e, a = this._projection.getTileXWithCenterLon(r, i), s = this._projection.getProjBoundsFromXYZ(r, n, i), l = this._projection.getLonLatBoundsFromXYZ(r, n, i);
    return { x: a, y: n, z: i, bounds: s, lonLatBounds: l };
  }
}
const W = new Qe(), Et = new S(0, -1, 0), pe = new S();
function De(o, t) {
  const e = t.intersectObject(o.rootTile, !0);
  if (e.length > 0) {
    const r = e[0];
    console.assert(r.object.visible);
    const n = o.worldToLocal(r.point.clone()), i = o.map2geo(n);
    return Object.assign(r, {
      location: i
    });
  }
}
function we(o, t) {
  return pe.set(t.x, 1e4, t.z), W.set(pe, Et), De(o, W);
}
function jt(o, t, e) {
  return W.setFromCamera(e, o), De(t, W);
}
function Ot(o) {
  const t = o.loader.manager, e = (r, n) => {
    o.dispatchEvent({ type: r, ...n });
  };
  t.onStart = (r, n, i) => {
    e("loading-start", { url: r, itemsLoaded: n, itemsTotal: i });
  }, t.onError = (r) => {
    e("loading-error", { url: r });
  }, t.onLoad = () => {
    e("loading-complete");
  }, t.onProgress = (r, n, i) => {
    e("loading-progress", { url: r, itemsLoaded: n, itemsTotal: i });
  }, t.onParseEnd = (r) => {
    e("parsing-end", { geometry: r });
  }, o.rootTile.addEventListener("tile-created", (r) => {
    e("tile-created", { tile: r.tile });
  }), o.rootTile.addEventListener("tile-loaded", (r) => {
    e("tile-loaded", { tile: r.tile });
  }), o.rootTile.addEventListener("tile-unload", (r) => {
    e("tile-unload", { tile: r.tile });
  }), o.rootTile.addEventListener("tile-visible-changed", (r) => {
    e("tile-visible-changed", { tile: r.tile });
  });
}
class _e extends ye {
  /**
   * 地图模型构造函数
   * @param params 地图参数 {@link MapParams}
   */
  constructor(e) {
    super();
    /** 名称 */
    u(this, "name", "map");
    /** 瓦片树更新时钟 */
    u(this, "_mapClock", new Je());
    /** 是否为LOD模型（LOD模型，当autoUpdate为真时渲染时会自动调用update方法）*/
    u(this, "isLOD", !0);
    /** 地图是否在每帧渲染时自动更新，默认为真 */
    u(this, "autoUpdate", !0);
    /** 调试标志，0：不调试 */
    u(this, "debug", 0);
    /** 瓦片树更新间隔，单位毫秒（默认100ms） */
    u(this, "updateInterval", 100);
    /** 根瓦片 */
    u(this, "rootTile");
    /** 瓦片数据加载器 */
    u(this, "loader");
    u(this, "_minLevel", 2);
    u(this, "_maxLevel", 19);
    u(this, "_LODThreshold", 1);
    this.up.set(0, 0, 1);
    const {
      loader: r = new Ct(),
      rootTile: n = new B(),
      minLevel: i = 2,
      maxLevel: a = 20,
      imgSource: s,
      demSource: l,
      backgroundColor: c,
      bounds: h,
      lon0: d = 0,
      debug: f = 0
    } = e;
    this._minLevel = i, this._maxLevel = a, this.loader = r, this.rootTile = n, c && this.loader.backgroundMaterial.color.set(c), h && (this.loader.bounds = h), this.debug = this.loader.debug = f, this.lon0 = d, this.imgSource = Array.isArray(s) ? s : [s], this.demSource = l, this.add(n), this._resize(), Ot(this);
    const m = () => {
      this.dispatchEvent({ type: "ready" }), this.removeEventListener("loading-complete", m);
    };
    this.addEventListener("loading-complete", m);
  }
  /** 取得地图最小缩放级别，小于这个级别瓦片树不再加载数据 */
  get minLevel() {
    return this._minLevel;
  }
  /** 设置地图最小缩放级别，小于这个级别瓦片树不再加载数据 */
  set minLevel(e) {
    this._minLevel = e;
  }
  /** 地图最大缩放级别，大于这个级别瓦片树不再更新 */
  get maxLevel() {
    return this._maxLevel;
  }
  /** 设置地图最大缩放级别，大于这个级别瓦片树不再更新 */
  set maxLevel(e) {
    this._maxLevel = e;
  }
  /** 取得中央子午线经度 */
  get lon0() {
    return this.projection.lon0;
  }
  /** 设置中央子午线经度，中央子午线决定了地图的投影中心经度，可设置为-90，0，90，默认为0 */
  set lon0(e) {
    this.projection.lon0 !== e && (e != 0 && this.minLevel < 1 && console.warn(`Map centralMeridian is ${this.lon0}, minLevel must > 0`), this.projection = ge.createFromID(this.projection.ID, e), this.updateSource());
  }
  /** 取得地图投影对象 */
  get projection() {
    return this.loader.projection;
  }
  /** 设置地图投影对象 */
  set projection(e) {
    (e.ID != this.projection.ID || e.lon0 != this.lon0) && (this.loader.projection = e, this._resize(), this.reload(), this.debug > 0 && console.log("Map Projection Changed:", e.ID, e.lon0), this.dispatchEvent({
      type: "projection-changed",
      projection: e
    }));
  }
  /** 取得影像数据源 */
  get imgSource() {
    return this.loader.imgSource;
  }
  /** 设置影像数据源 */
  set imgSource(e) {
    const r = Array.isArray(e) ? e : [e];
    if (r.length === 0)
      throw new Error("imgSource can not be empty");
    this.projection = ge.createFromID(r[0].projectionID, this.projection.lon0), this.loader.imgSource = r, this.updateSource(!0, !1), this.debug > 0 && console.log("Img Source Changed:", r), this.dispatchEvent({ type: "source-changed", source: e });
  }
  /** 设置地形数据源 */
  get demSource() {
    return this.loader.demSource;
  }
  /** 取得地形数据源 */
  set demSource(e) {
    this.loader.demSource = e, this.updateSource(!1, !0), this.debug > 0 && console.log("DEM Source Changed:", this.demSource), this.dispatchEvent({ type: "source-changed", source: e });
  }
  /** 取得LOD阈值	 */
  get LODThreshold() {
    return this._LODThreshold;
  }
  /** 设置LOD阈值，LOD阈值越大，瓦片细化，但耗费资源越高，建议取1-2之间，默认为1 */
  set LODThreshold(e) {
    this._LODThreshold = e;
  }
  /** 取得背景色 */
  get backgroundColor() {
    return this.loader.backgroundMaterial.color;
  }
  /** 设置背景色 */
  set backgroundColor(e) {
    this.loader.backgroundMaterial.color.set(e);
  }
  /** 取得地图经纬度范围 */
  get bounds() {
    return this.loader.bounds;
  }
  /** 设置地图经纬度范围 */
  set bounds(e) {
    this.loader.bounds = e;
  }
  /**
      * 地图创建工厂函数
        @param params 地图参数 {@link MapParams}
        @returns map mesh 地图模型
        ```
      */
  static create(e) {
    return new _e(e);
  }
  _resize() {
    this.rootTile.scale.set(this.projection.mapWidth, this.projection.mapHeight, this.projection.mapDepth), this.rootTile.updateMatrix(), this.rootTile.updateMatrixWorld();
  }
  /**
   * 模型更新回调函数，地图加入场景后会在每帧更新时被调用，该函数调用根瓦片实现瓦片树更新和数据加载
   * @param camera
   */
  update(e) {
    const r = this._mapClock.getElapsedTime();
    r > this.updateInterval / 1e3 && (this.rootTile.update({
      camera: e,
      loader: this.loader,
      minLevel: this.minLevel,
      maxLevel: this.maxLevel,
      LODThreshold: this.LODThreshold,
      lookahead: this.userData.lookahead ?? null
    }), this.rootTile.castShadow = this.castShadow, this.rootTile.receiveShadow = this.receiveShadow, this.dispatchEvent({ type: "update", delta: r }), this._mapClock.start());
  }
  /**
   * 重新加载地图数据
   * @param updateMaterial 是否重新加载材质，默认为true
   * @param updateGeometry 是否重新加载几何体, 默认为true
   */
  updateSource(e = !0, r = !0) {
    this.rootTile.updateData(e, r);
  }
  /**
   * 销毁全部瓦片并重新加载
   */
  reload() {
    this.rootTile.reload(this.loader);
  }
  /**
   * 释放地图资源，并移出场景
   */
  dispose() {
    this.removeFromParent(), this.reload();
  }
  /**
   * 地理坐标转换为地图模型坐标(与geo2map同功能)
   * @param geo 地理坐标（经纬度）
   * @returns 模型坐标
   * @deprecated This method is not recommended. Use geo2map() instead.
   */
  geo2pos(e) {
    return this.geo2map(e);
  }
  /**
   * 地理坐标转换为地图模型坐标(与geo2pos同功能)
   * @param geo 地理坐标（经纬度）
   * @returns 模型坐标
   */
  geo2map(e) {
    const r = this.projection.project(e.x, e.y);
    return new S(r.x, r.y, e.z);
  }
  /**
   * 地理坐标转换为世界坐标
   *
   * @param geo 地理坐标（经纬度）
   * @returns 世界坐标
   */
  geo2world(e) {
    return this.localToWorld(this.geo2map(e));
  }
  /**
   * 地图模型坐标转换为地理坐标(与map2geo同功能)
   * @param pos 模型坐标
   * @returns 地理坐标（经纬度）
   *  @deprecated This method is not recommended. Use map2geo() instead.
   */
  pos2geo(e) {
    return this.map2geo(e);
  }
  /**
   * 地图模型坐标转换为地理坐标(与pos2geo同功能)
   * @param map 模型坐标
   * @returns 地理坐标（经纬度）
   */
  map2geo(e) {
    const r = this.projection.unProject(e.x, e.y);
    return new S(r.lon, r.lat, e.z);
  }
  /**
   * 世界坐标转换为地理坐标
   *
   * @param world 世界坐标
   * @returns 地理坐标（经纬度）
   */
  world2geo(e) {
    return this.pos2geo(this.worldToLocal(e.clone()));
  }
  /**
   * 获取指定经纬度的地面信息（法向量、高度等）
   * @param geo 地理坐标
   * @returns 地面信息
   */
  getLocalInfoFromGeo(e) {
    const r = this.geo2world(e);
    return we(this, r);
  }
  /**
   * 获取指定世界坐标的地面信息
   * @param pos 世界坐标
   * @returns 地面信息
   */
  getLocalInfoFromWorld(e) {
    return we(this, e);
  }
  /**
   * 获取指定屏幕坐标的地面信息
   * @param camera 摄像机
   * @param pointer 点的屏幕坐标（-0.5~0.5）
   * @returns 位置信息（经纬度、高度等）
   */
  getLocalInfoFromScreen(e, r) {
    return jt(e, this, r);
  }
  /**
   * 取得当前正在下载的瓦片数量
   */
  get downloading() {
    return this.loader.downloadingThreads;
  }
  /**
   * 取得地图瓦片状态统计信息
   */
  getTileCount() {
    let e = 0, r = 0, n = 0, i = 0, a = 0, s = 0;
    return this.rootTile.traverse((l) => {
      l instanceof B && (e++, l.isLeaf && (a++, l.showing && r++, l.inFrustum && n++), i = Math.max(i, l.z), s = this.loader.downloadingThreads);
    }), { total: e, leaf: a, visible: r, inFrustum: n, maxLevel: i, downloading: s };
  }
}
function qt(o, t = 100) {
  return new Promise((e) => {
    const r = () => {
      o() ? e() : setTimeout(r, t);
    };
    r();
  });
}
function Be(o) {
  return y.registerMaterialLoader(o), o;
}
function re(o) {
  return y.registerGeometryLoader(o), o;
}
function Qt(o) {
  return y.getMaterialLoader(o);
}
function Jt(o) {
  return y.getGeometryLoader(o);
}
function Kt() {
  return y.getLoaders();
}
export {
  Vt as DebugCanvasLoader,
  y as LoaderFactory,
  Ht as Martini,
  Nt as PromiseWorker,
  Bt as TerrariumShaderLoader,
  B as Tile,
  kt as TileCanvasLoader,
  F as TileGeometry,
  te as TileGeometryLoader,
  Lt as TileImageLoader,
  Q as TileLoader,
  yt as TileLoadingManager,
  _e as TileMap,
  Me as TileMaterial,
  bt as TileMaterialLoader,
  Ue as TileSource,
  j as VectorFeatureTypes,
  Zt as VectorTileRender,
  dt as addSkirt,
  $t as applyTerrariumElevation,
  Ot as attachEvent,
  Yt as author,
  X as concatenateTypedArrays,
  N as decodeTerrariumTSL,
  ee as getBoundsCoord,
  Jt as getDEMLoader,
  gt as getGeometryDataFromDem,
  be as getGridIndices,
  Qt as getImgLoader,
  De as getLocalInfoFromRay,
  jt as getLocalInfoFromScreen,
  we as getLocalInfoFromWorld,
  ke as getNormals,
  Le as getSafeTileUrlAndBounds,
  xt as getSubImage,
  Kt as getTileLoaders,
  re as registerDEMLoader,
  Be as registerImgLoader,
  Pt as strTemplate,
  Mt as tileBoundsClip,
  z as version,
  qt as waitFor
};
