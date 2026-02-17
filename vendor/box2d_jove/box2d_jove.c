/**
 * Thin C wrapper around Box2D v3 for bun:ffi compatibility.
 *
 * bun:ffi cannot handle struct-by-value params/returns. This wrapper converts
 * Box2D's small structs (b2WorldId, b2BodyId, b2Vec2, etc.) to/from primitives
 * (u32, u64, float) and uses out-params for struct returns.
 *
 * ID packing:
 *   b2WorldId (4 bytes) → uint32_t
 *   b2BodyId, b2ShapeId, b2JointId, b2ChainId (8 bytes each) → uint64_t
 */

#include "box2d/box2d.h"
#include <string.h>
#include <math.h>

/* ── ID pack/unpack ─────────────────────────────────────────────────── */

static inline uint32_t pack_world(b2WorldId id) {
    uint32_t r; memcpy(&r, &id, 4); return r;
}
static inline b2WorldId unpack_world(uint32_t v) {
    b2WorldId r; memcpy(&r, &v, 4); return r;
}

static inline uint64_t pack_body(b2BodyId id) {
    uint64_t r = 0; memcpy(&r, &id, sizeof(b2BodyId)); return r;
}
static inline b2BodyId unpack_body(uint64_t v) {
    b2BodyId r; memcpy(&r, &v, sizeof(b2BodyId)); return r;
}

static inline uint64_t pack_shape(b2ShapeId id) {
    uint64_t r = 0; memcpy(&r, &id, sizeof(b2ShapeId)); return r;
}
static inline b2ShapeId unpack_shape(uint64_t v) {
    b2ShapeId r; memcpy(&r, &v, sizeof(b2ShapeId)); return r;
}

static inline uint64_t pack_joint(b2JointId id) {
    uint64_t r = 0; memcpy(&r, &id, sizeof(b2JointId)); return r;
}
static inline b2JointId unpack_joint(uint64_t v) {
    b2JointId r; memcpy(&r, &v, sizeof(b2JointId)); return r;
}

static inline uint64_t pack_chain(b2ChainId id) {
    uint64_t r = 0; memcpy(&r, &id, sizeof(b2ChainId)); return r;
}
static inline b2ChainId unpack_chain(uint64_t v) {
    b2ChainId r; memcpy(&r, &v, sizeof(b2ChainId)); return r;
}

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

/* Contact events — fills parallel arrays of packed shape IDs.
 * Returns total number of begin events. */
int jove_World_GetContactBeginEvents(uint32_t worldId, uint64_t* shapeA, uint64_t* shapeB, int maxCount) {
    b2ContactEvents events = b2World_GetContactEvents(unpack_world(worldId));
    int count = events.beginCount < maxCount ? events.beginCount : maxCount;
    for (int i = 0; i < count; i++) {
        shapeA[i] = pack_shape(events.beginEvents[i].shapeIdA);
        shapeB[i] = pack_shape(events.beginEvents[i].shapeIdB);
    }
    return count;
}

int jove_World_GetContactEndEvents(uint32_t worldId, uint64_t* shapeA, uint64_t* shapeB, int maxCount) {
    b2ContactEvents events = b2World_GetContactEvents(unpack_world(worldId));
    int count = events.endCount < maxCount ? events.endCount : maxCount;
    for (int i = 0; i < count; i++) {
        shapeA[i] = pack_shape(events.endEvents[i].shapeIdA);
        shapeB[i] = pack_shape(events.endEvents[i].shapeIdB);
    }
    return count;
}

int jove_World_GetContactHitEvents(uint32_t worldId, uint64_t* shapeA, uint64_t* shapeB,
                                    float* normalX, float* normalY, int maxCount) {
    b2ContactEvents events = b2World_GetContactEvents(unpack_world(worldId));
    int count = events.hitCount < maxCount ? events.hitCount : maxCount;
    for (int i = 0; i < count; i++) {
        shapeA[i] = pack_shape(events.hitEvents[i].shapeIdA);
        shapeB[i] = pack_shape(events.hitEvents[i].shapeIdB);
        normalX[i] = events.hitEvents[i].normal.x;
        normalY[i] = events.hitEvents[i].normal.y;
    }
    return count;
}

/* ── Body ───────────────────────────────────────────────────────────── */

uint64_t jove_CreateBody(uint32_t worldId, int type, float x, float y, float angle) {
    b2BodyDef def = b2DefaultBodyDef();
    def.type = (b2BodyType)type;
    def.position = (b2Vec2){x, y};
    def.rotation = b2MakeRot(angle);
    return pack_body(b2CreateBody(unpack_world(worldId), &def));
}

void jove_DestroyBody(uint64_t bodyId) {
    b2DestroyBody(unpack_body(bodyId));
}

void jove_Body_GetPosition(uint64_t bodyId, float* outX, float* outY) {
    b2Vec2 p = b2Body_GetPosition(unpack_body(bodyId));
    *outX = p.x;
    *outY = p.y;
}

void jove_Body_SetPosition(uint64_t bodyId, float x, float y) {
    b2BodyId bid = unpack_body(bodyId);
    b2Rot rot = b2Body_GetRotation(bid);
    b2Body_SetTransform(bid, (b2Vec2){x, y}, rot);
}

float jove_Body_GetAngle(uint64_t bodyId) {
    return b2Rot_GetAngle(b2Body_GetRotation(unpack_body(bodyId)));
}

void jove_Body_SetAngle(uint64_t bodyId, float angle) {
    b2BodyId bid = unpack_body(bodyId);
    b2Vec2 pos = b2Body_GetPosition(bid);
    b2Body_SetTransform(bid, pos, b2MakeRot(angle));
}

void jove_Body_GetLinearVelocity(uint64_t bodyId, float* outX, float* outY) {
    b2Vec2 v = b2Body_GetLinearVelocity(unpack_body(bodyId));
    *outX = v.x;
    *outY = v.y;
}

void jove_Body_SetLinearVelocity(uint64_t bodyId, float vx, float vy) {
    b2Body_SetLinearVelocity(unpack_body(bodyId), (b2Vec2){vx, vy});
}

float jove_Body_GetAngularVelocity(uint64_t bodyId) {
    return b2Body_GetAngularVelocity(unpack_body(bodyId));
}

void jove_Body_SetAngularVelocity(uint64_t bodyId, float omega) {
    b2Body_SetAngularVelocity(unpack_body(bodyId), omega);
}

void jove_Body_ApplyForce(uint64_t bodyId, float fx, float fy, float px, float py, int wake) {
    b2Body_ApplyForce(unpack_body(bodyId), (b2Vec2){fx, fy}, (b2Vec2){px, py}, wake ? true : false);
}

void jove_Body_ApplyTorque(uint64_t bodyId, float torque, int wake) {
    b2Body_ApplyTorque(unpack_body(bodyId), torque, wake ? true : false);
}

void jove_Body_ApplyLinearImpulse(uint64_t bodyId, float ix, float iy, float px, float py, int wake) {
    b2Body_ApplyLinearImpulse(unpack_body(bodyId), (b2Vec2){ix, iy}, (b2Vec2){px, py}, wake ? true : false);
}

float jove_Body_GetMass(uint64_t bodyId) {
    return b2Body_GetMass(unpack_body(bodyId));
}

int jove_Body_GetType(uint64_t bodyId) {
    return (int)b2Body_GetType(unpack_body(bodyId));
}

void jove_Body_SetType(uint64_t bodyId, int type) {
    b2Body_SetType(unpack_body(bodyId), (b2BodyType)type);
}

void jove_Body_SetBullet(uint64_t bodyId, int flag) {
    b2Body_SetBullet(unpack_body(bodyId), flag ? true : false);
}

int jove_Body_IsBullet(uint64_t bodyId) {
    return b2Body_IsBullet(unpack_body(bodyId)) ? 1 : 0;
}

void jove_Body_SetEnabled(uint64_t bodyId, int flag) {
    if (flag)
        b2Body_Enable(unpack_body(bodyId));
    else
        b2Body_Disable(unpack_body(bodyId));
}

int jove_Body_IsEnabled(uint64_t bodyId) {
    return b2Body_IsEnabled(unpack_body(bodyId)) ? 1 : 0;
}

void jove_Body_SetAwake(uint64_t bodyId, int flag) {
    b2Body_SetAwake(unpack_body(bodyId), flag ? true : false);
}

int jove_Body_IsAwake(uint64_t bodyId) {
    return b2Body_IsAwake(unpack_body(bodyId)) ? 1 : 0;
}

void jove_Body_SetFixedRotation(uint64_t bodyId, int flag) {
    b2Body_SetFixedRotation(unpack_body(bodyId), flag ? true : false);
}

int jove_Body_IsFixedRotation(uint64_t bodyId) {
    return b2Body_IsFixedRotation(unpack_body(bodyId)) ? 1 : 0;
}

void jove_Body_SetSleepingAllowed(uint64_t bodyId, int flag) {
    b2Body_EnableSleep(unpack_body(bodyId), flag ? true : false);
}

int jove_Body_IsSleepingAllowed(uint64_t bodyId) {
    return b2Body_IsSleepEnabled(unpack_body(bodyId)) ? 1 : 0;
}

void jove_Body_SetGravityScale(uint64_t bodyId, float scale) {
    b2Body_SetGravityScale(unpack_body(bodyId), scale);
}

float jove_Body_GetGravityScale(uint64_t bodyId) {
    return b2Body_GetGravityScale(unpack_body(bodyId));
}

void jove_Body_SetLinearDamping(uint64_t bodyId, float damping) {
    b2Body_SetLinearDamping(unpack_body(bodyId), damping);
}

float jove_Body_GetLinearDamping(uint64_t bodyId) {
    return b2Body_GetLinearDamping(unpack_body(bodyId));
}

void jove_Body_SetAngularDamping(uint64_t bodyId, float damping) {
    b2Body_SetAngularDamping(unpack_body(bodyId), damping);
}

float jove_Body_GetAngularDamping(uint64_t bodyId) {
    return b2Body_GetAngularDamping(unpack_body(bodyId));
}

void jove_Body_ApplyForceToCenter(uint64_t bodyId, float fx, float fy, int wake) {
    b2Body_ApplyForceToCenter(unpack_body(bodyId), (b2Vec2){fx, fy}, wake ? true : false);
}

void jove_Body_ApplyLinearImpulseToCenter(uint64_t bodyId, float ix, float iy, int wake) {
    b2Body_ApplyLinearImpulseToCenter(unpack_body(bodyId), (b2Vec2){ix, iy}, wake ? true : false);
}

void jove_Body_GetMassData(uint64_t bodyId, float* outMass, float* outCx, float* outCy, float* outI) {
    b2MassData md = b2Body_GetMassData(unpack_body(bodyId));
    *outMass = md.mass;
    *outCx = md.center.x;
    *outCy = md.center.y;
    *outI = md.rotationalInertia;
}

void jove_Body_GetWorldPoint(uint64_t bodyId, float lx, float ly, float* outX, float* outY) {
    b2Vec2 wp = b2Body_GetWorldPoint(unpack_body(bodyId), (b2Vec2){lx, ly});
    *outX = wp.x;
    *outY = wp.y;
}

void jove_Body_GetLocalPoint(uint64_t bodyId, float wx, float wy, float* outX, float* outY) {
    b2Vec2 lp = b2Body_GetLocalPoint(unpack_body(bodyId), (b2Vec2){wx, wy});
    *outX = lp.x;
    *outY = lp.y;
}

/* ── Shapes (→ Fixture in love2d) ───────────────────────────────────── */

uint64_t jove_CreateCircleShape(uint64_t bodyId, float density, float friction,
                                 float restitution, int sensor, int hitEvents,
                                 float cx, float cy, float radius) {
    b2ShapeDef def = b2DefaultShapeDef();
    def.density = density;
    def.material.friction = friction;
    def.material.restitution = restitution;
    def.isSensor = sensor ? true : false;
    def.enableContactEvents = true;
    def.enableHitEvents = hitEvents ? true : false;
    b2Circle circle = { .center = {cx, cy}, .radius = radius };
    return pack_shape(b2CreateCircleShape(unpack_body(bodyId), &def, &circle));
}

uint64_t jove_CreateBoxShape(uint64_t bodyId, float density, float friction,
                              float restitution, int sensor, int hitEvents,
                              float hw, float hh) {
    b2ShapeDef def = b2DefaultShapeDef();
    def.density = density;
    def.material.friction = friction;
    def.material.restitution = restitution;
    def.isSensor = sensor ? true : false;
    def.enableContactEvents = true;
    def.enableHitEvents = hitEvents ? true : false;
    b2Polygon box = b2MakeBox(hw, hh);
    return pack_shape(b2CreatePolygonShape(unpack_body(bodyId), &def, &box));
}

uint64_t jove_CreatePolygonShape(uint64_t bodyId, float density, float friction,
                                  float restitution, int sensor, int hitEvents,
                                  const float* verts, int count) {
    b2ShapeDef def = b2DefaultShapeDef();
    def.density = density;
    def.material.friction = friction;
    def.material.restitution = restitution;
    def.isSensor = sensor ? true : false;
    def.enableContactEvents = true;
    def.enableHitEvents = hitEvents ? true : false;
    b2Vec2 points[B2_MAX_POLYGON_VERTICES];
    int n = count < B2_MAX_POLYGON_VERTICES ? count : B2_MAX_POLYGON_VERTICES;
    for (int i = 0; i < n; i++) {
        points[i] = (b2Vec2){verts[i*2], verts[i*2+1]};
    }
    b2Hull hull = b2ComputeHull(points, n);
    b2Polygon poly = b2MakePolygon(&hull, 0.0f);
    return pack_shape(b2CreatePolygonShape(unpack_body(bodyId), &def, &poly));
}

uint64_t jove_CreateEdgeShape(uint64_t bodyId, float density, float friction,
                               float restitution, int sensor, int hitEvents,
                               float x1, float y1, float x2, float y2) {
    b2ShapeDef def = b2DefaultShapeDef();
    def.density = density;
    def.material.friction = friction;
    def.material.restitution = restitution;
    def.isSensor = sensor ? true : false;
    def.enableContactEvents = true;
    def.enableHitEvents = hitEvents ? true : false;
    b2Segment segment = { .point1 = {x1, y1}, .point2 = {x2, y2} };
    return pack_shape(b2CreateSegmentShape(unpack_body(bodyId), &def, &segment));
}

uint64_t jove_CreateChainShape(uint64_t bodyId, float friction, float restitution,
                                const float* verts, int count, int loop) {
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
    return pack_chain(b2CreateChain(unpack_body(bodyId), &def));
}

void jove_DestroyShape(uint64_t shapeId) {
    b2DestroyShape(unpack_shape(shapeId), true);
}

void jove_DestroyChain(uint64_t chainId) {
    b2DestroyChain(unpack_chain(chainId));
}

void jove_Shape_SetSensor(uint64_t shapeId, int flag) {
    b2Shape_EnableSensorEvents(unpack_shape(shapeId), flag ? true : false);
}

void jove_Shape_EnableHitEvents(uint64_t shapeId, int flag) {
    b2Shape_EnableHitEvents(unpack_shape(shapeId), flag ? true : false);
}

int jove_Shape_IsSensor(uint64_t shapeId) {
    return b2Shape_IsSensor(unpack_shape(shapeId)) ? 1 : 0;
}

void jove_Shape_SetFriction(uint64_t shapeId, float f) {
    b2Shape_SetFriction(unpack_shape(shapeId), f);
}

float jove_Shape_GetFriction(uint64_t shapeId) {
    return b2Shape_GetFriction(unpack_shape(shapeId));
}

void jove_Shape_SetRestitution(uint64_t shapeId, float r) {
    b2Shape_SetRestitution(unpack_shape(shapeId), r);
}

float jove_Shape_GetRestitution(uint64_t shapeId) {
    return b2Shape_GetRestitution(unpack_shape(shapeId));
}

void jove_Shape_SetDensity(uint64_t shapeId, float d) {
    b2Shape_SetDensity(unpack_shape(shapeId), d, true);
}

float jove_Shape_GetDensity(uint64_t shapeId) {
    return b2Shape_GetDensity(unpack_shape(shapeId));
}

void jove_Shape_SetFilter(uint64_t shapeId, uint16_t cat, uint16_t mask, int16_t group) {
    b2Filter filter = { .categoryBits = cat, .maskBits = mask, .groupIndex = group };
    b2Shape_SetFilter(unpack_shape(shapeId), filter);
}

void jove_Shape_GetFilter(uint64_t shapeId, uint16_t* outCat, uint16_t* outMask, int16_t* outGroup) {
    b2Filter f = b2Shape_GetFilter(unpack_shape(shapeId));
    *outCat = f.categoryBits;
    *outMask = f.maskBits;
    *outGroup = f.groupIndex;
}

uint64_t jove_Shape_GetBody(uint64_t shapeId) {
    return pack_body(b2Shape_GetBody(unpack_shape(shapeId)));
}

int jove_Shape_GetType(uint64_t shapeId) {
    return (int)b2Shape_GetType(unpack_shape(shapeId));
}

/* ── Joints ─────────────────────────────────────────────────────────── */

uint64_t jove_CreateDistanceJoint(uint32_t worldId, uint64_t bodyA, uint64_t bodyB,
                                   float ax, float ay, float bx, float by, int collide) {
    b2DistanceJointDef def = b2DefaultDistanceJointDef();
    def.bodyIdA = unpack_body(bodyA);
    def.bodyIdB = unpack_body(bodyB);
    def.localAnchorA = (b2Vec2){ax, ay};
    def.localAnchorB = (b2Vec2){bx, by};
    float dx = bx - ax, dy = by - ay;
    def.length = sqrtf(dx*dx + dy*dy);
    def.collideConnected = collide ? true : false;
    return pack_joint(b2CreateDistanceJoint(unpack_world(worldId), &def));
}

uint64_t jove_CreateRevoluteJoint(uint32_t worldId, uint64_t bodyA, uint64_t bodyB,
                                   float ax, float ay, float bx, float by, int collide) {
    b2RevoluteJointDef def = b2DefaultRevoluteJointDef();
    def.bodyIdA = unpack_body(bodyA);
    def.bodyIdB = unpack_body(bodyB);
    def.localAnchorA = (b2Vec2){ax, ay};
    def.localAnchorB = (b2Vec2){bx, by};
    def.collideConnected = collide ? true : false;
    return pack_joint(b2CreateRevoluteJoint(unpack_world(worldId), &def));
}

uint64_t jove_CreatePrismaticJoint(uint32_t worldId, uint64_t bodyA, uint64_t bodyB,
                                    float ax, float ay, float bx, float by,
                                    float axisX, float axisY, int collide) {
    b2PrismaticJointDef def = b2DefaultPrismaticJointDef();
    def.bodyIdA = unpack_body(bodyA);
    def.bodyIdB = unpack_body(bodyB);
    def.localAnchorA = (b2Vec2){ax, ay};
    def.localAnchorB = (b2Vec2){bx, by};
    def.localAxisA = (b2Vec2){axisX, axisY};
    def.collideConnected = collide ? true : false;
    return pack_joint(b2CreatePrismaticJoint(unpack_world(worldId), &def));
}

uint64_t jove_CreateWeldJoint(uint32_t worldId, uint64_t bodyA, uint64_t bodyB,
                               float ax, float ay, float bx, float by, int collide) {
    b2WeldJointDef def = b2DefaultWeldJointDef();
    def.bodyIdA = unpack_body(bodyA);
    def.bodyIdB = unpack_body(bodyB);
    def.localAnchorA = (b2Vec2){ax, ay};
    def.localAnchorB = (b2Vec2){bx, by};
    def.collideConnected = collide ? true : false;
    return pack_joint(b2CreateWeldJoint(unpack_world(worldId), &def));
}

uint64_t jove_CreateMouseJoint(uint32_t worldId, uint64_t bodyA, uint64_t bodyB,
                                float tx, float ty) {
    b2MouseJointDef def = b2DefaultMouseJointDef();
    def.bodyIdA = unpack_body(bodyA);
    def.bodyIdB = unpack_body(bodyB);
    def.target = (b2Vec2){tx, ty};
    def.maxForce = 1000.0f * b2Body_GetMass(unpack_body(bodyB));
    return pack_joint(b2CreateMouseJoint(unpack_world(worldId), &def));
}

void jove_DestroyJoint(uint64_t jointId) {
    b2DestroyJoint(unpack_joint(jointId));
}

int jove_Joint_GetType(uint64_t jointId) {
    return (int)b2Joint_GetType(unpack_joint(jointId));
}

uint64_t jove_Joint_GetBodyA(uint64_t jointId) {
    return pack_body(b2Joint_GetBodyA(unpack_joint(jointId)));
}

uint64_t jove_Joint_GetBodyB(uint64_t jointId) {
    return pack_body(b2Joint_GetBodyB(unpack_joint(jointId)));
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
uint64_t jove_CreateWheelJoint(uint32_t worldId, uint64_t bodyA, uint64_t bodyB,
                                float ax, float ay, float bx, float by,
                                float axisX, float axisY, int collide) {
    b2WheelJointDef def = b2DefaultWheelJointDef();
    def.bodyIdA = unpack_body(bodyA);
    def.bodyIdB = unpack_body(bodyB);
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
uint64_t jove_CreateMotorJoint(uint32_t worldId, uint64_t bodyA, uint64_t bodyB,
                                float correctionFactor, int collide) {
    b2MotorJointDef def = b2DefaultMotorJointDef();
    def.bodyIdA = unpack_body(bodyA);
    def.bodyIdB = unpack_body(bodyB);
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

/* Body mass data override */
void jove_Body_SetMassData(uint64_t bodyId, float mass, float cx, float cy, float inertia) {
    b2MassData md;
    md.mass = mass;
    md.center = (b2Vec2){cx, cy};
    md.rotationalInertia = inertia;
    b2Body_SetMassData(unpack_body(bodyId), md);
}

/* Hit events with approach speed */
int jove_World_GetContactHitEventsEx(uint32_t worldId, uint64_t* shapeA, uint64_t* shapeB,
                                      float* normalX, float* normalY,
                                      float* pointX, float* pointY,
                                      float* approachSpeed, int maxCount) {
    b2ContactEvents events = b2World_GetContactEvents(unpack_world(worldId));
    int count = events.hitCount < maxCount ? events.hitCount : maxCount;
    for (int i = 0; i < count; i++) {
        shapeA[i] = pack_shape(events.hitEvents[i].shapeIdA);
        shapeB[i] = pack_shape(events.hitEvents[i].shapeIdB);
        normalX[i] = events.hitEvents[i].normal.x;
        normalY[i] = events.hitEvents[i].normal.y;
        pointX[i] = events.hitEvents[i].point.x;
        pointY[i] = events.hitEvents[i].point.y;
        approachSpeed[i] = events.hitEvents[i].approachSpeed;
    }
    return count;
}

/* ── Queries ────────────────────────────────────────────────────────── */

/* Custom ray cast callback context */
typedef struct {
    float hitX, hitY;
    float normalX, normalY;
    float fraction;
    uint64_t shapeId;
    int hit;
} RayCastResult;

static float _rayCastCallback(b2ShapeId shapeId, b2Vec2 point, b2Vec2 normal, float fraction, void* context) {
    RayCastResult* result = (RayCastResult*)context;
    result->hitX = point.x;
    result->hitY = point.y;
    result->normalX = normal.x;
    result->normalY = normal.y;
    result->fraction = fraction;
    result->shapeId = pack_shape(shapeId);
    result->hit = 1;
    return fraction; /* clip to closest hit */
}

int jove_World_RayCast(uint32_t worldId, float ox, float oy, float dx, float dy,
                        float* outX, float* outY, float* outNx, float* outNy,
                        float* outFrac, uint64_t* outShape) {
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
        *outShape = result.shapeId;
    }
    return result.hit;
}

/* AABB query callback context */
typedef struct {
    uint64_t* shapes;
    int count;
    int maxCount;
} AABBQueryResult;

static bool _aabbQueryCallback(b2ShapeId shapeId, void* context) {
    AABBQueryResult* result = (AABBQueryResult*)context;
    if (result->count < result->maxCount) {
        result->shapes[result->count++] = pack_shape(shapeId);
    }
    return result->count < result->maxCount; /* continue if room */
}

int jove_World_QueryAABB(uint32_t worldId, float minX, float minY, float maxX, float maxY,
                          uint64_t* outShapes, int maxCount) {
    AABBQueryResult result = { .shapes = outShapes, .count = 0, .maxCount = maxCount };
    b2AABB aabb = { .lowerBound = {minX, minY}, .upperBound = {maxX, maxY} };
    b2QueryFilter filter = b2DefaultQueryFilter();
    b2World_OverlapAABB(unpack_world(worldId), aabb, filter, _aabbQueryCallback, &result);
    return result.count;
}
