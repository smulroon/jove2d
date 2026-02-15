// Box2D v3 FFI bindings via bun:ffi (through thin C wrapper)
// Separate from ffi.ts so the engine works even without Box2D installed.

import { dlopen, FFIType } from "bun:ffi";
import { resolve } from "path";

const BOX2D_LIB_PATH = resolve(
  import.meta.dir,
  "../../vendor/box2d/install/lib/libbox2d_jove.so"
);

let box2d: ReturnType<typeof _load> | null = null;
let _tried = false;

function _load() {
  const { symbols } = dlopen(BOX2D_LIB_PATH, {
    /* ── World ──────────────────────────────────────────────────── */
    jove_CreateWorld: {
      args: [FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.u32,
    },
    jove_DestroyWorld: {
      args: [FFIType.u32],
      returns: FFIType.void,
    },
    jove_World_Step: {
      args: [FFIType.u32, FFIType.f32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_World_SetGravity: {
      args: [FFIType.u32, FFIType.f32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_World_GetGravity: {
      args: [FFIType.u32, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_World_GetBodyCount: {
      args: [FFIType.u32],
      returns: FFIType.i32,
    },
    jove_World_GetContactBeginEvents: {
      args: [FFIType.u32, FFIType.pointer, FFIType.pointer, FFIType.i32],
      returns: FFIType.i32,
    },
    jove_World_GetContactEndEvents: {
      args: [FFIType.u32, FFIType.pointer, FFIType.pointer, FFIType.i32],
      returns: FFIType.i32,
    },
    jove_World_GetContactHitEvents: {
      args: [FFIType.u32, FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.i32],
      returns: FFIType.i32,
    },

    /* ── Body ───────────────────────────────────────────────────── */
    jove_CreateBody: {
      args: [FFIType.u32, FFIType.i32, FFIType.f32, FFIType.f32, FFIType.f32],
      returns: FFIType.u64,
    },
    jove_DestroyBody: {
      args: [FFIType.u64],
      returns: FFIType.void,
    },
    jove_Body_GetPosition: {
      args: [FFIType.u64, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Body_SetPosition: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetAngle: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_Body_SetAngle: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetLinearVelocity: {
      args: [FFIType.u64, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Body_SetLinearVelocity: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetAngularVelocity: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_Body_SetAngularVelocity: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_ApplyForce: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_ApplyTorque: {
      args: [FFIType.u64, FFIType.f32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_ApplyLinearImpulse: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_GetMass: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_Body_GetType: {
      args: [FFIType.u64],
      returns: FFIType.i32,
    },
    jove_Body_SetType: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_SetBullet: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_IsBullet: {
      args: [FFIType.u64],
      returns: FFIType.i32,
    },
    jove_Body_SetEnabled: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_IsEnabled: {
      args: [FFIType.u64],
      returns: FFIType.i32,
    },
    jove_Body_SetAwake: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_IsAwake: {
      args: [FFIType.u64],
      returns: FFIType.i32,
    },
    jove_Body_SetFixedRotation: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_IsFixedRotation: {
      args: [FFIType.u64],
      returns: FFIType.i32,
    },
    jove_Body_SetSleepingAllowed: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_IsSleepingAllowed: {
      args: [FFIType.u64],
      returns: FFIType.i32,
    },
    jove_Body_SetGravityScale: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetGravityScale: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_Body_SetLinearDamping: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetLinearDamping: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_Body_SetAngularDamping: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetAngularDamping: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_Body_ApplyForceToCenter: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_ApplyLinearImpulseToCenter: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_GetMassData: {
      args: [FFIType.u64, FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Body_GetWorldPoint: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Body_GetLocalPoint: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },

    /* ── Shapes ─────────────────────────────────────────────────── */
    jove_CreateCircleShape: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32,
             FFIType.f32, FFIType.f32, FFIType.f32],
      returns: FFIType.u64,
    },
    jove_CreateBoxShape: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32,
             FFIType.f32, FFIType.f32],
      returns: FFIType.u64,
    },
    jove_CreatePolygonShape: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32,
             FFIType.pointer, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_CreateEdgeShape: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32,
             FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32],
      returns: FFIType.u64,
    },
    jove_CreateChainShape: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32,
             FFIType.pointer, FFIType.i32, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_DestroyShape: {
      args: [FFIType.u64],
      returns: FFIType.void,
    },
    jove_DestroyChain: {
      args: [FFIType.u64],
      returns: FFIType.void,
    },
    jove_Shape_SetSensor: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Shape_IsSensor: {
      args: [FFIType.u64],
      returns: FFIType.i32,
    },
    jove_Shape_SetFriction: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Shape_GetFriction: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_Shape_SetRestitution: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Shape_GetRestitution: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_Shape_SetDensity: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Shape_GetDensity: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_Shape_SetFilter: {
      args: [FFIType.u64, FFIType.u16, FFIType.u16, FFIType.i16],
      returns: FFIType.void,
    },
    jove_Shape_GetFilter: {
      args: [FFIType.u64, FFIType.pointer, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Shape_GetBody: {
      args: [FFIType.u64],
      returns: FFIType.u64,
    },
    jove_Shape_GetType: {
      args: [FFIType.u64],
      returns: FFIType.i32,
    },

    /* ── Joints ─────────────────────────────────────────────────── */
    jove_CreateDistanceJoint: {
      args: [FFIType.u32, FFIType.u64, FFIType.u64,
             FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_CreateRevoluteJoint: {
      args: [FFIType.u32, FFIType.u64, FFIType.u64,
             FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_CreatePrismaticJoint: {
      args: [FFIType.u32, FFIType.u64, FFIType.u64,
             FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32,
             FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_CreateWeldJoint: {
      args: [FFIType.u32, FFIType.u64, FFIType.u64,
             FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_CreateMouseJoint: {
      args: [FFIType.u32, FFIType.u64, FFIType.u64, FFIType.f32, FFIType.f32],
      returns: FFIType.u64,
    },
    jove_DestroyJoint: {
      args: [FFIType.u64],
      returns: FFIType.void,
    },
    jove_Joint_GetType: {
      args: [FFIType.u64],
      returns: FFIType.i32,
    },
    jove_Joint_GetBodyA: {
      args: [FFIType.u64],
      returns: FFIType.u64,
    },
    jove_Joint_GetBodyB: {
      args: [FFIType.u64],
      returns: FFIType.u64,
    },
    jove_Joint_SetCollideConnected: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Joint_GetCollideConnected: {
      args: [FFIType.u64],
      returns: FFIType.i32,
    },
    jove_DistanceJoint_SetLength: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_DistanceJoint_GetLength: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_RevoluteJoint_GetAngle: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_RevoluteJoint_EnableLimit: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_RevoluteJoint_SetLimits: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_RevoluteJoint_EnableMotor: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_RevoluteJoint_SetMotorSpeed: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_RevoluteJoint_SetMaxMotorTorque: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_PrismaticJoint_EnableLimit: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_PrismaticJoint_SetLimits: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_PrismaticJoint_EnableMotor: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_PrismaticJoint_SetMotorSpeed: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_PrismaticJoint_SetMaxMotorForce: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_MouseJoint_SetTarget: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_MouseJoint_GetTarget: {
      args: [FFIType.u64, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },

    /* ── Queries ────────────────────────────────────────────────── */
    jove_World_RayCast: {
      args: [FFIType.u32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32,
             FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer,
             FFIType.pointer, FFIType.pointer],
      returns: FFIType.i32,
    },
    jove_World_QueryAABB: {
      args: [FFIType.u32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32,
             FFIType.pointer, FFIType.i32],
      returns: FFIType.i32,
    },
  });
  return symbols;
}

/**
 * Try to load Box2D. Returns the symbols or null if unavailable.
 * Safe to call multiple times — caches the result.
 */
export function loadBox2D(): typeof box2d {
  if (_tried) return box2d;
  _tried = true;
  try {
    box2d = _load();
  } catch {
    // Box2D not available — engine works without it
    box2d = null;
  }
  return box2d;
}

export default loadBox2D;
