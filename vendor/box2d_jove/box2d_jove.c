/**
 * Thin C wrapper around Box2D v3 for bun:ffi compatibility.
 *
 * Body and shape IDs are stored in C-side static arrays. JS uses plain int
 * indices instead of packed u64/BigInt, eliminating the Bun FFI BigInt bug
 * that causes crashes under high call volume.
 *
 * Joints remain as packed u64 (infrequent operations).
 *
 * jove_World_UpdateFull does step + event reads in 1 call (instead of ~650).
 */

#include "box2d/box2d.h"
#include <string.h>
#include <math.h>
#include <stdint.h>

/* ── ID pack/unpack (world and joint only) ────────────────────────── */

static inline uint32_t pack_world(b2WorldId id) {
    uint32_t r; memcpy(&r, &id, 4); return r;
}
static inline b2WorldId unpack_world(uint32_t v) {
    b2WorldId r; memcpy(&r, &v, 4); return r;
}

static inline uint64_t pack_joint(b2JointId id) {
    uint64_t r = 0; memcpy(&r, &id, sizeof(b2JointId)); return r;
}
static inline b2JointId unpack_joint(uint64_t v) {
    b2JointId r; memcpy(&r, &v, sizeof(b2JointId)); return r;
}

/* ── C-side body/shape index storage ──────────────────────────────── */

#define MAX_BODIES 4096
#define MAX_SHAPES 8192

static b2BodyId  g_bodies[MAX_BODIES];
static int       g_bodyFree[MAX_BODIES];
static int       g_bodyFreeCount = 0;
static int       g_bodyNextIdx = 0;

static b2ShapeId g_shapes[MAX_SHAPES];
static b2ChainId g_chains[MAX_SHAPES];
static uint8_t   g_shapeIsChain[MAX_SHAPES];
static int       g_shapeFree[MAX_SHAPES];
static int       g_shapeFreeCount = 0;
static int       g_shapeNextIdx = 0;

static int alloc_body(void) {
    if (g_bodyFreeCount > 0) return g_bodyFree[--g_bodyFreeCount];
    if (g_bodyNextIdx < MAX_BODIES) return g_bodyNextIdx++;
    return -1;
}

static void free_body(int idx) {
    if (idx >= 0 && idx < MAX_BODIES && g_bodyFreeCount < MAX_BODIES)
        g_bodyFree[g_bodyFreeCount++] = idx;
}

static int alloc_shape(void) {
    if (g_shapeFreeCount > 0) return g_shapeFree[--g_shapeFreeCount];
    if (g_shapeNextIdx < MAX_SHAPES) return g_shapeNextIdx++;
    return -1;
}

static void free_shape(int idx) {
    if (idx >= 0 && idx < MAX_SHAPES && g_shapeFreeCount < MAX_SHAPES)
        g_shapeFree[g_shapeFreeCount++] = idx;
}

/* Index management — free indices without destroying Box2D objects.
 * Used by JS when a World is destroyed (Box2D destroys everything,
 * but we need to recycle C-side indices). */
void jove_FreeBodyIndex(int idx) { free_body(idx); }
void jove_FreeShapeIndex(int idx) { free_shape(idx); }

/* ── World ──────────────────────────────────────────────────────────── */

uint32_t jove_CreateWorld(float gx, float gy, int allowSleep, float hitEventThreshold) {
    b2WorldDef def = b2DefaultWorldDef();
    def.gravity = (b2Vec2){gx, gy};
    def.enableSleep = allowSleep ? true : false;
    def.hitEventThreshold = hitEventThreshold;
    return pack_world(b2CreateWorld(&def));
}

void jove_DestroyWorld(uint32_t worldId) {
    b2DestroyWorld(unpack_world(worldId));
}

void jove_World_Step(uint32_t worldId, float dt, int subSteps) {
    b2World_Step(unpack_world(worldId), dt, subSteps);
}

void jove_World_SetGravity(uint32_t worldId, float gx, float gy) {
    b2World_SetGravity(unpack_world(worldId), (b2Vec2){gx, gy});
}

void jove_World_GetGravity(uint32_t worldId, float* outX, float* outY) {
    b2Vec2 g = b2World_GetGravity(unpack_world(worldId));
    *outX = g.x;
    *outY = g.y;
}

int jove_World_GetBodyCount(uint32_t worldId) {
    b2Counters c = b2World_GetCounters(unpack_world(worldId));
    return c.bodyCount;
}

/* ── Combined update — 1 FFI call per frame ────────────────────────── */

void jove_World_UpdateFull(
    uint32_t worldId, float dt, int subSteps,
    /* Body move events (out) */
    int* moveBodyIdx, float* movePosX, float* movePosY, float* moveAngle, int maxMove,
    /* Contact begin events (out) */
    int* beginShapeA, int* beginShapeB, int maxBegin,
    /* Contact end events (out) */
    int* endShapeA, int* endShapeB, int maxEnd,
    /* Contact hit events (out) */
    int* hitShapeA, int* hitShapeB,
    float* hitNormX, float* hitNormY,
    float* hitPointX, float* hitPointY, float* hitSpeed, int maxHit,
    /* Output counts: [moveCount, beginCount, endCount, hitCount] */
    int* outCounts)
{
    b2WorldId wid = unpack_world(worldId);

    /* 1. Step */
    b2World_Step(wid, dt, subSteps);

    /* 2. Body move events */
    b2BodyEvents bodyEvents = b2World_GetBodyEvents(wid);
    int mc = bodyEvents.moveCount < maxMove ? bodyEvents.moveCount : maxMove;
    for (int i = 0; i < mc; i++) {
        b2BodyMoveEvent* me = &bodyEvents.moveEvents[i];
        int idx = me->userData ? (int)(intptr_t)me->userData - 1 : -1;
        moveBodyIdx[i] = idx;
        movePosX[i] = me->transform.p.x;
        movePosY[i] = me->transform.p.y;
        moveAngle[i] = b2Rot_GetAngle(me->transform.q);
    }
    outCounts[0] = mc;

    /* 3. Contact events */
    b2ContactEvents contactEvents = b2World_GetContactEvents(wid);

    /* Begin */
    int bc = contactEvents.beginCount < maxBegin ? contactEvents.beginCount : maxBegin;
    for (int i = 0; i < bc; i++) {
        void* udA = b2Shape_GetUserData(contactEvents.beginEvents[i].shapeIdA);
        void* udB = b2Shape_GetUserData(contactEvents.beginEvents[i].shapeIdB);
        beginShapeA[i] = udA ? (int)(intptr_t)udA - 1 : -1;
        beginShapeB[i] = udB ? (int)(intptr_t)udB - 1 : -1;
    }
    outCounts[1] = bc;

    /* End */
    int ec = contactEvents.endCount < maxEnd ? contactEvents.endCount : maxEnd;
    for (int i = 0; i < ec; i++) {
        void* udA = b2Shape_GetUserData(contactEvents.endEvents[i].shapeIdA);
        void* udB = b2Shape_GetUserData(contactEvents.endEvents[i].shapeIdB);
        endShapeA[i] = udA ? (int)(intptr_t)udA - 1 : -1;
        endShapeB[i] = udB ? (int)(intptr_t)udB - 1 : -1;
    }
    outCounts[2] = ec;

    /* Hit */
    int hc = contactEvents.hitCount < maxHit ? contactEvents.hitCount : maxHit;
    for (int i = 0; i < hc; i++) {
        b2ContactHitEvent* he = &contactEvents.hitEvents[i];
        void* udA = b2Shape_GetUserData(he->shapeIdA);
        void* udB = b2Shape_GetUserData(he->shapeIdB);
        hitShapeA[i] = udA ? (int)(intptr_t)udA - 1 : -1;
        hitShapeB[i] = udB ? (int)(intptr_t)udB - 1 : -1;
        hitNormX[i] = he->normal.x;
        hitNormY[i] = he->normal.y;
        hitPointX[i] = he->point.x;
        hitPointY[i] = he->point.y;
        hitSpeed[i] = he->approachSpeed;
    }
    outCounts[3] = hc;
}

/* ── Body ───────────────────────────────────────────────────────────── */

int jove_CreateBody(uint32_t worldId, int type, float x, float y, float angle) {
    int idx = alloc_body();
    if (idx < 0) return -1;
    b2BodyDef def = b2DefaultBodyDef();
    def.type = (b2BodyType)type;
    def.position = (b2Vec2){x, y};
    def.rotation = b2MakeRot(angle);
    def.userData = (void*)(intptr_t)(idx + 1);
    g_bodies[idx] = b2CreateBody(unpack_world(worldId), &def);
    return idx;
}

void jove_DestroyBody(int bodyIdx) {
    b2DestroyBody(g_bodies[bodyIdx]);
    free_body(bodyIdx);
}

void jove_Body_GetPosition(int bodyIdx, float* outX, float* outY) {
    b2Vec2 p = b2Body_GetPosition(g_bodies[bodyIdx]);
    *outX = p.x;
    *outY = p.y;
}

void jove_Body_SetPosition(int bodyIdx, float x, float y) {
    b2BodyId bid = g_bodies[bodyIdx];
    b2Rot rot = b2Body_GetRotation(bid);
    b2Body_SetTransform(bid, (b2Vec2){x, y}, rot);
}

float jove_Body_GetAngle(int bodyIdx) {
    return b2Rot_GetAngle(b2Body_GetRotation(g_bodies[bodyIdx]));
}

void jove_Body_SetAngle(int bodyIdx, float angle) {
    b2BodyId bid = g_bodies[bodyIdx];
    b2Vec2 pos = b2Body_GetPosition(bid);
    b2Body_SetTransform(bid, pos, b2MakeRot(angle));
}

void jove_Body_GetLinearVelocity(int bodyIdx, float* outX, float* outY) {
    b2Vec2 v = b2Body_GetLinearVelocity(g_bodies[bodyIdx]);
    *outX = v.x;
    *outY = v.y;
}

void jove_Body_SetLinearVelocity(int bodyIdx, float vx, float vy) {
    b2Body_SetLinearVelocity(g_bodies[bodyIdx], (b2Vec2){vx, vy});
}

float jove_Body_GetAngularVelocity(int bodyIdx) {
    return b2Body_GetAngularVelocity(g_bodies[bodyIdx]);
}

void jove_Body_SetAngularVelocity(int bodyIdx, float omega) {
    b2Body_SetAngularVelocity(g_bodies[bodyIdx], omega);
}

void jove_Body_ApplyForce(int bodyIdx, float fx, float fy, float px, float py, int wake) {
    b2Body_ApplyForce(g_bodies[bodyIdx], (b2Vec2){fx, fy}, (b2Vec2){px, py}, wake ? true : false);
}

void jove_Body_ApplyTorque(int bodyIdx, float torque, int wake) {
    b2Body_ApplyTorque(g_bodies[bodyIdx], torque, wake ? true : false);
}

void jove_Body_ApplyLinearImpulse(int bodyIdx, float ix, float iy, float px, float py, int wake) {
    b2Body_ApplyLinearImpulse(g_bodies[bodyIdx], (b2Vec2){ix, iy}, (b2Vec2){px, py}, wake ? true : false);
}

float jove_Body_GetMass(int bodyIdx) {
    return b2Body_GetMass(g_bodies[bodyIdx]);
}

int jove_Body_GetType(int bodyIdx) {
    return (int)b2Body_GetType(g_bodies[bodyIdx]);
}

void jove_Body_SetType(int bodyIdx, int type) {
    b2Body_SetType(g_bodies[bodyIdx], (b2BodyType)type);
}

void jove_Body_SetBullet(int bodyIdx, int flag) {
    b2Body_SetBullet(g_bodies[bodyIdx], flag ? true : false);
}

int jove_Body_IsBullet(int bodyIdx) {
    return b2Body_IsBullet(g_bodies[bodyIdx]) ? 1 : 0;
}

void jove_Body_SetEnabled(int bodyIdx, int flag) {
    if (flag)
        b2Body_Enable(g_bodies[bodyIdx]);
    else
        b2Body_Disable(g_bodies[bodyIdx]);
}

int jove_Body_IsEnabled(int bodyIdx) {
    return b2Body_IsEnabled(g_bodies[bodyIdx]) ? 1 : 0;
}

void jove_Body_SetAwake(int bodyIdx, int flag) {
    b2Body_SetAwake(g_bodies[bodyIdx], flag ? true : false);
}

int jove_Body_IsAwake(int bodyIdx) {
    return b2Body_IsAwake(g_bodies[bodyIdx]) ? 1 : 0;
}

void jove_Body_SetFixedRotation(int bodyIdx, int flag) {
    b2Body_SetFixedRotation(g_bodies[bodyIdx], flag ? true : false);
}

int jove_Body_IsFixedRotation(int bodyIdx) {
    return b2Body_IsFixedRotation(g_bodies[bodyIdx]) ? 1 : 0;
}

void jove_Body_SetSleepingAllowed(int bodyIdx, int flag) {
    b2Body_EnableSleep(g_bodies[bodyIdx], flag ? true : false);
}

int jove_Body_IsSleepingAllowed(int bodyIdx) {
    return b2Body_IsSleepEnabled(g_bodies[bodyIdx]) ? 1 : 0;
}

void jove_Body_SetGravityScale(int bodyIdx, float scale) {
    b2Body_SetGravityScale(g_bodies[bodyIdx], scale);
}

float jove_Body_GetGravityScale(int bodyIdx) {
    return b2Body_GetGravityScale(g_bodies[bodyIdx]);
}

void jove_Body_SetLinearDamping(int bodyIdx, float damping) {
    b2Body_SetLinearDamping(g_bodies[bodyIdx], damping);
}

float jove_Body_GetLinearDamping(int bodyIdx) {
    return b2Body_GetLinearDamping(g_bodies[bodyIdx]);
}

void jove_Body_SetAngularDamping(int bodyIdx, float damping) {
    b2Body_SetAngularDamping(g_bodies[bodyIdx], damping);
}

float jove_Body_GetAngularDamping(int bodyIdx) {
    return b2Body_GetAngularDamping(g_bodies[bodyIdx]);
}

void jove_Body_ApplyForceToCenter(int bodyIdx, float fx, float fy, int wake) {
    b2Body_ApplyForceToCenter(g_bodies[bodyIdx], (b2Vec2){fx, fy}, wake ? true : false);
}

void jove_Body_ApplyLinearImpulseToCenter(int bodyIdx, float ix, float iy, int wake) {
    b2Body_ApplyLinearImpulseToCenter(g_bodies[bodyIdx], (b2Vec2){ix, iy}, wake ? true : false);
}

void jove_Body_GetMassData(int bodyIdx, float* outMass, float* outCx, float* outCy, float* outI) {
    b2MassData md = b2Body_GetMassData(g_bodies[bodyIdx]);
    *outMass = md.mass;
    *outCx = md.center.x;
    *outCy = md.center.y;
    *outI = md.rotationalInertia;
}

void jove_Body_GetWorldPoint(int bodyIdx, float lx, float ly, float* outX, float* outY) {
    b2Vec2 wp = b2Body_GetWorldPoint(g_bodies[bodyIdx], (b2Vec2){lx, ly});
    *outX = wp.x;
    *outY = wp.y;
}

void jove_Body_GetLocalPoint(int bodyIdx, float wx, float wy, float* outX, float* outY) {
    b2Vec2 lp = b2Body_GetLocalPoint(g_bodies[bodyIdx], (b2Vec2){wx, wy});
    *outX = lp.x;
    *outY = lp.y;
}

void jove_Body_SetMassData(int bodyIdx, float mass, float cx, float cy, float inertia) {
    b2MassData md;
    md.mass = mass;
    md.center = (b2Vec2){cx, cy};
    md.rotationalInertia = inertia;
    b2Body_SetMassData(g_bodies[bodyIdx], md);
}

/* ── Shapes (→ Fixture in love2d) ───────────────────────────────────── */

int jove_CreateCircleShape(int bodyIdx, float density, float friction,
                           float restitution, int sensor, int hitEvents,
                           float cx, float cy, float radius) {
    int idx = alloc_shape();
    if (idx < 0) return -1;
    b2ShapeDef def = b2DefaultShapeDef();
    def.density = density;
    def.material.friction = friction;
    def.material.restitution = restitution;
    def.isSensor = sensor ? true : false;
    def.enableContactEvents = true;
    def.enableHitEvents = hitEvents ? true : false;
    def.userData = (void*)(intptr_t)(idx + 1);
    b2Circle circle = { .center = {cx, cy}, .radius = radius };
    g_shapes[idx] = b2CreateCircleShape(g_bodies[bodyIdx], &def, &circle);
    g_shapeIsChain[idx] = 0;
    return idx;
}

int jove_CreateBoxShape(int bodyIdx, float density, float friction,
                        float restitution, int sensor, int hitEvents,
                        float hw, float hh) {
    int idx = alloc_shape();
    if (idx < 0) return -1;
    b2ShapeDef def = b2DefaultShapeDef();
    def.density = density;
    def.material.friction = friction;
    def.material.restitution = restitution;
    def.isSensor = sensor ? true : false;
    def.enableContactEvents = true;
    def.enableHitEvents = hitEvents ? true : false;
    def.userData = (void*)(intptr_t)(idx + 1);
    b2Polygon box = b2MakeBox(hw, hh);
    g_shapes[idx] = b2CreatePolygonShape(g_bodies[bodyIdx], &def, &box);
    g_shapeIsChain[idx] = 0;
    return idx;
}

int jove_CreatePolygonShape(int bodyIdx, float density, float friction,
                            float restitution, int sensor, int hitEvents,
                            const float* verts, int count) {
    int idx = alloc_shape();
    if (idx < 0) return -1;
    b2ShapeDef def = b2DefaultShapeDef();
    def.density = density;
    def.material.friction = friction;
    def.material.restitution = restitution;
    def.isSensor = sensor ? true : false;
    def.enableContactEvents = true;
    def.enableHitEvents = hitEvents ? true : false;
    def.userData = (void*)(intptr_t)(idx + 1);
    b2Vec2 points[B2_MAX_POLYGON_VERTICES];
    int n = count < B2_MAX_POLYGON_VERTICES ? count : B2_MAX_POLYGON_VERTICES;
    for (int i = 0; i < n; i++) {
        points[i] = (b2Vec2){verts[i*2], verts[i*2+1]};
    }
    b2Hull hull = b2ComputeHull(points, n);
    b2Polygon poly = b2MakePolygon(&hull, 0.0f);
    g_shapes[idx] = b2CreatePolygonShape(g_bodies[bodyIdx], &def, &poly);
    g_shapeIsChain[idx] = 0;
    return idx;
}

int jove_CreateEdgeShape(int bodyIdx, float density, float friction,
                         float restitution, int sensor, int hitEvents,
                         float x1, float y1, float x2, float y2) {
    int idx = alloc_shape();
    if (idx < 0) return -1;
    b2ShapeDef def = b2DefaultShapeDef();
    def.density = density;
    def.material.friction = friction;
    def.material.restitution = restitution;
    def.isSensor = sensor ? true : false;
    def.enableContactEvents = true;
    def.enableHitEvents = hitEvents ? true : false;
    def.userData = (void*)(intptr_t)(idx + 1);
    b2Segment segment = { .point1 = {x1, y1}, .point2 = {x2, y2} };
    g_shapes[idx] = b2CreateSegmentShape(g_bodies[bodyIdx], &def, &segment);
    g_shapeIsChain[idx] = 0;
    return idx;
}

int jove_CreateChainShape(int bodyIdx, float friction, float restitution,
                          const float* verts, int count, int loop) {
    int idx = alloc_shape();
    if (idx < 0) return -1;
    b2ChainDef def = b2DefaultChainDef();
    b2SurfaceMaterial mat = {0};
    mat.friction = friction;
    mat.restitution = restitution;
    def.materials = &mat;
    def.materialCount = 1;
    def.isLoop = loop ? true : false;
    b2Vec2* points = (b2Vec2*)verts; /* float pairs are layout-compatible with b2Vec2 */
    def.points = points;
    def.count = count;
    g_chains[idx] = b2CreateChain(g_bodies[bodyIdx], &def);
    g_shapeIsChain[idx] = 1;
    return idx;
}

void jove_DestroyShape(int shapeIdx) {
    b2DestroyShape(g_shapes[shapeIdx], true);
    free_shape(shapeIdx);
}

void jove_DestroyChain(int shapeIdx) {
    b2DestroyChain(g_chains[shapeIdx]);
    free_shape(shapeIdx);
}

void jove_Shape_SetSensor(int shapeIdx, int flag) {
    b2Shape_EnableSensorEvents(g_shapes[shapeIdx], flag ? true : false);
}

void jove_Shape_EnableHitEvents(int shapeIdx, int flag) {
    b2Shape_EnableHitEvents(g_shapes[shapeIdx], flag ? true : false);
}

int jove_Shape_IsSensor(int shapeIdx) {
    return b2Shape_IsSensor(g_shapes[shapeIdx]) ? 1 : 0;
}

void jove_Shape_SetFriction(int shapeIdx, float f) {
    b2Shape_SetFriction(g_shapes[shapeIdx], f);
}

float jove_Shape_GetFriction(int shapeIdx) {
    return b2Shape_GetFriction(g_shapes[shapeIdx]);
}

void jove_Shape_SetRestitution(int shapeIdx, float r) {
    b2Shape_SetRestitution(g_shapes[shapeIdx], r);
}

float jove_Shape_GetRestitution(int shapeIdx) {
    return b2Shape_GetRestitution(g_shapes[shapeIdx]);
}

void jove_Shape_SetDensity(int shapeIdx, float d) {
    b2Shape_SetDensity(g_shapes[shapeIdx], d, true);
}

float jove_Shape_GetDensity(int shapeIdx) {
    return b2Shape_GetDensity(g_shapes[shapeIdx]);
}

void jove_Shape_SetFilter(int shapeIdx, uint16_t cat, uint16_t mask, int16_t group) {
    b2Filter filter = { .categoryBits = cat, .maskBits = mask, .groupIndex = group };
    b2Shape_SetFilter(g_shapes[shapeIdx], filter);
}

void jove_Shape_GetFilter(int shapeIdx, uint16_t* outCat, uint16_t* outMask, int16_t* outGroup) {
    b2Filter f = b2Shape_GetFilter(g_shapes[shapeIdx]);
    *outCat = f.categoryBits;
    *outMask = f.maskBits;
    *outGroup = f.groupIndex;
}

int jove_Shape_GetBody(int shapeIdx) {
    b2BodyId body = b2Shape_GetBody(g_shapes[shapeIdx]);
    void* ud = b2Body_GetUserData(body);
    return ud ? (int)(intptr_t)ud - 1 : -1;
}

int jove_Shape_GetType(int shapeIdx) {
    return (int)b2Shape_GetType(g_shapes[shapeIdx]);
}

/* ── Joints ─────────────────────────────────────────────────────────── */

uint64_t jove_CreateDistanceJoint(uint32_t worldId, int bodyIdxA, int bodyIdxB,
                                   float ax, float ay, float bx, float by, int collide) {
    b2DistanceJointDef def = b2DefaultDistanceJointDef();
    def.bodyIdA = g_bodies[bodyIdxA];
    def.bodyIdB = g_bodies[bodyIdxB];
    def.localAnchorA = (b2Vec2){ax, ay};
    def.localAnchorB = (b2Vec2){bx, by};
    float dx = bx - ax, dy = by - ay;
    def.length = sqrtf(dx*dx + dy*dy);
    def.collideConnected = collide ? true : false;
    return pack_joint(b2CreateDistanceJoint(unpack_world(worldId), &def));
}

uint64_t jove_CreateRevoluteJoint(uint32_t worldId, int bodyIdxA, int bodyIdxB,
                                   float ax, float ay, float bx, float by, int collide) {
    b2RevoluteJointDef def = b2DefaultRevoluteJointDef();
    def.bodyIdA = g_bodies[bodyIdxA];
    def.bodyIdB = g_bodies[bodyIdxB];
    def.localAnchorA = (b2Vec2){ax, ay};
    def.localAnchorB = (b2Vec2){bx, by};
    def.collideConnected = collide ? true : false;
    return pack_joint(b2CreateRevoluteJoint(unpack_world(worldId), &def));
}

uint64_t jove_CreatePrismaticJoint(uint32_t worldId, int bodyIdxA, int bodyIdxB,
                                    float ax, float ay, float bx, float by,
                                    float axisX, float axisY, int collide) {
    b2PrismaticJointDef def = b2DefaultPrismaticJointDef();
    def.bodyIdA = g_bodies[bodyIdxA];
    def.bodyIdB = g_bodies[bodyIdxB];
    def.localAnchorA = (b2Vec2){ax, ay};
    def.localAnchorB = (b2Vec2){bx, by};
    def.localAxisA = (b2Vec2){axisX, axisY};
    def.collideConnected = collide ? true : false;
    return pack_joint(b2CreatePrismaticJoint(unpack_world(worldId), &def));
}

uint64_t jove_CreateWeldJoint(uint32_t worldId, int bodyIdxA, int bodyIdxB,
                               float ax, float ay, float bx, float by, int collide) {
    b2WeldJointDef def = b2DefaultWeldJointDef();
    def.bodyIdA = g_bodies[bodyIdxA];
    def.bodyIdB = g_bodies[bodyIdxB];
    def.localAnchorA = (b2Vec2){ax, ay};
    def.localAnchorB = (b2Vec2){bx, by};
    def.collideConnected = collide ? true : false;
    return pack_joint(b2CreateWeldJoint(unpack_world(worldId), &def));
}

uint64_t jove_CreateMouseJoint(uint32_t worldId, int bodyIdxA, int bodyIdxB,
                                float tx, float ty) {
    b2MouseJointDef def = b2DefaultMouseJointDef();
    def.bodyIdA = g_bodies[bodyIdxA];
    def.bodyIdB = g_bodies[bodyIdxB];
    def.target = (b2Vec2){tx, ty};
    def.maxForce = 1000.0f * b2Body_GetMass(g_bodies[bodyIdxB]);
    return pack_joint(b2CreateMouseJoint(unpack_world(worldId), &def));
}

void jove_DestroyJoint(uint64_t jointId) {
    b2DestroyJoint(unpack_joint(jointId));
}

int jove_Joint_GetType(uint64_t jointId) {
    return (int)b2Joint_GetType(unpack_joint(jointId));
}

int jove_Joint_GetBodyA(uint64_t jointId) {
    b2BodyId body = b2Joint_GetBodyA(unpack_joint(jointId));
    void* ud = b2Body_GetUserData(body);
    return ud ? (int)(intptr_t)ud - 1 : -1;
}

int jove_Joint_GetBodyB(uint64_t jointId) {
    b2BodyId body = b2Joint_GetBodyB(unpack_joint(jointId));
    void* ud = b2Body_GetUserData(body);
    return ud ? (int)(intptr_t)ud - 1 : -1;
}

void jove_Joint_SetCollideConnected(uint64_t jointId, int flag) {
    b2Joint_SetCollideConnected(unpack_joint(jointId), flag ? true : false);
}

int jove_Joint_GetCollideConnected(uint64_t jointId) {
    return b2Joint_GetCollideConnected(unpack_joint(jointId)) ? 1 : 0;
}

/* Distance joint specifics */
void jove_DistanceJoint_SetLength(uint64_t jointId, float length) {
    b2DistanceJoint_SetLength(unpack_joint(jointId), length);
}

float jove_DistanceJoint_GetLength(uint64_t jointId) {
    return b2DistanceJoint_GetLength(unpack_joint(jointId));
}

/* Revolute joint specifics */
float jove_RevoluteJoint_GetAngle(uint64_t jointId) {
    return b2RevoluteJoint_GetAngle(unpack_joint(jointId));
}

void jove_RevoluteJoint_EnableLimit(uint64_t jointId, int flag) {
    b2RevoluteJoint_EnableLimit(unpack_joint(jointId), flag ? true : false);
}

void jove_RevoluteJoint_SetLimits(uint64_t jointId, float lower, float upper) {
    b2RevoluteJoint_SetLimits(unpack_joint(jointId), lower, upper);
}

void jove_RevoluteJoint_EnableMotor(uint64_t jointId, int flag) {
    b2RevoluteJoint_EnableMotor(unpack_joint(jointId), flag ? true : false);
}

void jove_RevoluteJoint_SetMotorSpeed(uint64_t jointId, float speed) {
    b2RevoluteJoint_SetMotorSpeed(unpack_joint(jointId), speed);
}

void jove_RevoluteJoint_SetMaxMotorTorque(uint64_t jointId, float torque) {
    b2RevoluteJoint_SetMaxMotorTorque(unpack_joint(jointId), torque);
}

/* Prismatic joint specifics */
void jove_PrismaticJoint_EnableLimit(uint64_t jointId, int flag) {
    b2PrismaticJoint_EnableLimit(unpack_joint(jointId), flag ? true : false);
}

void jove_PrismaticJoint_SetLimits(uint64_t jointId, float lower, float upper) {
    b2PrismaticJoint_SetLimits(unpack_joint(jointId), lower, upper);
}

void jove_PrismaticJoint_EnableMotor(uint64_t jointId, int flag) {
    b2PrismaticJoint_EnableMotor(unpack_joint(jointId), flag ? true : false);
}

void jove_PrismaticJoint_SetMotorSpeed(uint64_t jointId, float speed) {
    b2PrismaticJoint_SetMotorSpeed(unpack_joint(jointId), speed);
}

void jove_PrismaticJoint_SetMaxMotorForce(uint64_t jointId, float force) {
    b2PrismaticJoint_SetMaxMotorForce(unpack_joint(jointId), force);
}

/* Mouse joint specifics */
void jove_MouseJoint_SetTarget(uint64_t jointId, float x, float y) {
    b2MouseJoint_SetTarget(unpack_joint(jointId), (b2Vec2){x, y});
}

void jove_MouseJoint_GetTarget(uint64_t jointId, float* outX, float* outY) {
    b2Vec2 t = b2MouseJoint_GetTarget(unpack_joint(jointId));
    *outX = t.x;
    *outY = t.y;
}

/* Wheel joint */
uint64_t jove_CreateWheelJoint(uint32_t worldId, int bodyIdxA, int bodyIdxB,
                                float ax, float ay, float bx, float by,
                                float axisX, float axisY, int collide) {
    b2WheelJointDef def = b2DefaultWheelJointDef();
    def.bodyIdA = g_bodies[bodyIdxA];
    def.bodyIdB = g_bodies[bodyIdxB];
    def.localAnchorA = (b2Vec2){ax, ay};
    def.localAnchorB = (b2Vec2){bx, by};
    def.localAxisA = (b2Vec2){axisX, axisY};
    def.collideConnected = collide ? true : false;
    return pack_joint(b2CreateWheelJoint(unpack_world(worldId), &def));
}

void jove_WheelJoint_EnableSpring(uint64_t jointId, int flag) {
    b2WheelJoint_EnableSpring(unpack_joint(jointId), flag ? true : false);
}

void jove_WheelJoint_SetSpringHertz(uint64_t jointId, float hertz) {
    b2WheelJoint_SetSpringHertz(unpack_joint(jointId), hertz);
}

float jove_WheelJoint_GetSpringHertz(uint64_t jointId) {
    return b2WheelJoint_GetSpringHertz(unpack_joint(jointId));
}

void jove_WheelJoint_SetSpringDampingRatio(uint64_t jointId, float ratio) {
    b2WheelJoint_SetSpringDampingRatio(unpack_joint(jointId), ratio);
}

float jove_WheelJoint_GetSpringDampingRatio(uint64_t jointId) {
    return b2WheelJoint_GetSpringDampingRatio(unpack_joint(jointId));
}

void jove_WheelJoint_EnableLimit(uint64_t jointId, int flag) {
    b2WheelJoint_EnableLimit(unpack_joint(jointId), flag ? true : false);
}

void jove_WheelJoint_SetLimits(uint64_t jointId, float lower, float upper) {
    b2WheelJoint_SetLimits(unpack_joint(jointId), lower, upper);
}

void jove_WheelJoint_EnableMotor(uint64_t jointId, int flag) {
    b2WheelJoint_EnableMotor(unpack_joint(jointId), flag ? true : false);
}

void jove_WheelJoint_SetMotorSpeed(uint64_t jointId, float speed) {
    b2WheelJoint_SetMotorSpeed(unpack_joint(jointId), speed);
}

void jove_WheelJoint_SetMaxMotorTorque(uint64_t jointId, float torque) {
    b2WheelJoint_SetMaxMotorTorque(unpack_joint(jointId), torque);
}

float jove_WheelJoint_GetMotorTorque(uint64_t jointId) {
    return b2WheelJoint_GetMotorTorque(unpack_joint(jointId));
}

/* Motor joint */
uint64_t jove_CreateMotorJoint(uint32_t worldId, int bodyIdxA, int bodyIdxB,
                                float correctionFactor, int collide) {
    b2MotorJointDef def = b2DefaultMotorJointDef();
    def.bodyIdA = g_bodies[bodyIdxA];
    def.bodyIdB = g_bodies[bodyIdxB];
    def.correctionFactor = correctionFactor;
    def.collideConnected = collide ? true : false;
    return pack_joint(b2CreateMotorJoint(unpack_world(worldId), &def));
}

void jove_MotorJoint_SetLinearOffset(uint64_t jointId, float x, float y) {
    b2MotorJoint_SetLinearOffset(unpack_joint(jointId), (b2Vec2){x, y});
}

void jove_MotorJoint_GetLinearOffset(uint64_t jointId, float* outX, float* outY) {
    b2Vec2 v = b2MotorJoint_GetLinearOffset(unpack_joint(jointId));
    *outX = v.x;
    *outY = v.y;
}

void jove_MotorJoint_SetAngularOffset(uint64_t jointId, float offset) {
    b2MotorJoint_SetAngularOffset(unpack_joint(jointId), offset);
}

float jove_MotorJoint_GetAngularOffset(uint64_t jointId) {
    return b2MotorJoint_GetAngularOffset(unpack_joint(jointId));
}

void jove_MotorJoint_SetMaxForce(uint64_t jointId, float force) {
    b2MotorJoint_SetMaxForce(unpack_joint(jointId), force);
}

void jove_MotorJoint_SetMaxTorque(uint64_t jointId, float torque) {
    b2MotorJoint_SetMaxTorque(unpack_joint(jointId), torque);
}

void jove_MotorJoint_SetCorrectionFactor(uint64_t jointId, float factor) {
    b2MotorJoint_SetCorrectionFactor(unpack_joint(jointId), factor);
}

/* Joint anchor queries (world-space) */
void jove_Joint_GetAnchorA(uint64_t jointId, float* outX, float* outY) {
    b2Vec2 a = b2Joint_GetLocalAnchorA(unpack_joint(jointId));
    b2BodyId bodyA = b2Joint_GetBodyA(unpack_joint(jointId));
    b2Vec2 w = b2Body_GetWorldPoint(bodyA, a);
    *outX = w.x;
    *outY = w.y;
}

void jove_Joint_GetAnchorB(uint64_t jointId, float* outX, float* outY) {
    b2Vec2 a = b2Joint_GetLocalAnchorB(unpack_joint(jointId));
    b2BodyId bodyB = b2Joint_GetBodyB(unpack_joint(jointId));
    b2Vec2 w = b2Body_GetWorldPoint(bodyB, a);
    *outX = w.x;
    *outY = w.y;
}

/* Joint reaction force/torque */
void jove_Joint_GetReactionForce(uint64_t jointId, float invDt, float* outX, float* outY) {
    b2Vec2 f = b2Joint_GetConstraintForce(unpack_joint(jointId));
    *outX = f.x * invDt;
    *outY = f.y * invDt;
}

float jove_Joint_GetReactionTorque(uint64_t jointId, float invDt) {
    return b2Joint_GetConstraintTorque(unpack_joint(jointId)) * invDt;
}

/* ── Queries ────────────────────────────────────────────────────────── */

/* Custom ray cast callback context */
typedef struct {
    float hitX, hitY;
    float normalX, normalY;
    float fraction;
    int shapeIdx;
    int hit;
} RayCastResult;

static float _rayCastCallback(b2ShapeId shapeId, b2Vec2 point, b2Vec2 normal, float fraction, void* context) {
    RayCastResult* result = (RayCastResult*)context;
    result->hitX = point.x;
    result->hitY = point.y;
    result->normalX = normal.x;
    result->normalY = normal.y;
    result->fraction = fraction;
    void* ud = b2Shape_GetUserData(shapeId);
    result->shapeIdx = ud ? (int)(intptr_t)ud - 1 : -1;
    result->hit = 1;
    return fraction; /* clip to closest hit */
}

int jove_World_RayCast(uint32_t worldId, float ox, float oy, float dx, float dy,
                        float* outX, float* outY, float* outNx, float* outNy,
                        float* outFrac, int* outShape) {
    RayCastResult result = {0};
    b2Vec2 origin = {ox, oy};
    b2Vec2 translation = {dx - ox, dy - oy};
    b2QueryFilter filter = b2DefaultQueryFilter();
    b2World_CastRay(unpack_world(worldId), origin, translation, filter, _rayCastCallback, &result);
    if (result.hit) {
        *outX = result.hitX;
        *outY = result.hitY;
        *outNx = result.normalX;
        *outNy = result.normalY;
        *outFrac = result.fraction;
        *outShape = result.shapeIdx;
    }
    return result.hit;
}

/* AABB query callback context */
typedef struct {
    int* shapes;
    int count;
    int maxCount;
} AABBQueryResult;

static bool _aabbQueryCallback(b2ShapeId shapeId, void* context) {
    AABBQueryResult* result = (AABBQueryResult*)context;
    void* ud = b2Shape_GetUserData(shapeId);
    int idx = ud ? (int)(intptr_t)ud - 1 : -1;
    if (result->count < result->maxCount) {
        result->shapes[result->count++] = idx;
    }
    return result->count < result->maxCount; /* continue if room */
}

int jove_World_QueryAABB(uint32_t worldId, float minX, float minY, float maxX, float maxY,
                          int* outShapes, int maxCount) {
    AABBQueryResult result = { .shapes = outShapes, .count = 0, .maxCount = maxCount };
    b2AABB aabb = { .lowerBound = {minX, minY}, .upperBound = {maxX, maxY} };
    b2QueryFilter filter = b2DefaultQueryFilter();
    b2World_OverlapAABB(unpack_world(worldId), aabb, filter, _aabbQueryCallback, &result);
    return result.count;
}
