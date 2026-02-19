// Box2D v3 FFI bindings via bun:ffi (through thin C wrapper)
// Separate from ffi.ts so the engine works even without Box2D installed.
//
// Body/shape IDs use i32 indices (C-side static arrays).
// Joint IDs remain u64 (infrequent operations).

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
      args: [FFIType.f32, FFIType.f32, FFIType.i32, FFIType.f32],
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

    /* Combined update — 1 FFI call per frame */
    jove_World_UpdateFull: {
      args: [FFIType.u32, FFIType.f32, FFIType.i32,
             // move events
             FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.i32,
             // begin events
             FFIType.pointer, FFIType.pointer, FFIType.i32,
             // end events
             FFIType.pointer, FFIType.pointer, FFIType.i32,
             // hit events
             FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.i32,
             // preSolve events
             FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.i32,
             // output counts
             FFIType.pointer],
      returns: FFIType.void,
    },

    /* PreSolve enable list */
    jove_World_SetPreSolveEnableList: {
      args: [FFIType.pointer, FFIType.pointer, FFIType.i32],
      returns: FFIType.void,
    },

    /* Index management */
    jove_FreeBodyIndex: {
      args: [FFIType.i32],
      returns: FFIType.void,
    },
    jove_FreeShapeIndex: {
      args: [FFIType.i32],
      returns: FFIType.void,
    },

    /* ── Body ───────────────────────────────────────────────────── */
    jove_CreateBody: {
      args: [FFIType.u32, FFIType.i32, FFIType.f32, FFIType.f32, FFIType.f32],
      returns: FFIType.i32,
    },
    jove_DestroyBody: {
      args: [FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_GetPosition: {
      args: [FFIType.i32, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Body_SetPosition: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetAngle: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    jove_Body_SetAngle: {
      args: [FFIType.i32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetLinearVelocity: {
      args: [FFIType.i32, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Body_SetLinearVelocity: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetAngularVelocity: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    jove_Body_SetAngularVelocity: {
      args: [FFIType.i32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_ApplyForce: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_ApplyTorque: {
      args: [FFIType.i32, FFIType.f32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_ApplyLinearImpulse: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_GetMass: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    jove_Body_GetType: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    jove_Body_SetType: {
      args: [FFIType.i32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_SetBullet: {
      args: [FFIType.i32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_IsBullet: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    jove_Body_SetEnabled: {
      args: [FFIType.i32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_IsEnabled: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    jove_Body_SetAwake: {
      args: [FFIType.i32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_IsAwake: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    jove_Body_SetFixedRotation: {
      args: [FFIType.i32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_IsFixedRotation: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    jove_Body_SetSleepingAllowed: {
      args: [FFIType.i32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_IsSleepingAllowed: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    jove_Body_SetGravityScale: {
      args: [FFIType.i32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetGravityScale: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    jove_Body_SetLinearDamping: {
      args: [FFIType.i32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetLinearDamping: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    jove_Body_SetAngularDamping: {
      args: [FFIType.i32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Body_GetAngularDamping: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    jove_Body_ApplyForceToCenter: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_ApplyLinearImpulseToCenter: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Body_GetMassData: {
      args: [FFIType.i32, FFIType.pointer, FFIType.pointer, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Body_GetWorldPoint: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Body_GetLocalPoint: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Body_SetMassData: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32],
      returns: FFIType.void,
    },

    /* ── Shapes ─────────────────────────────────────────────────── */
    jove_CreateCircleShape: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32, FFIType.i32, FFIType.i32,
             FFIType.f32, FFIType.f32, FFIType.f32],
      returns: FFIType.i32,
    },
    jove_CreateBoxShape: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32, FFIType.i32, FFIType.i32,
             FFIType.f32, FFIType.f32],
      returns: FFIType.i32,
    },
    jove_CreatePolygonShape: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32, FFIType.i32, FFIType.i32,
             FFIType.pointer, FFIType.i32],
      returns: FFIType.i32,
    },
    jove_CreateEdgeShape: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32, FFIType.i32, FFIType.i32,
             FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32],
      returns: FFIType.i32,
    },
    jove_CreateChainShape: {
      args: [FFIType.i32, FFIType.f32, FFIType.f32,
             FFIType.pointer, FFIType.i32, FFIType.i32],
      returns: FFIType.i32,
    },
    jove_DestroyShape: {
      args: [FFIType.i32],
      returns: FFIType.void,
    },
    jove_DestroyChain: {
      args: [FFIType.i32],
      returns: FFIType.void,
    },
    jove_Shape_SetSensor: {
      args: [FFIType.i32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Shape_IsSensor: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    jove_Shape_EnableHitEvents: {
      args: [FFIType.i32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Shape_EnablePreSolveEvents: {
      args: [FFIType.i32, FFIType.i32],
      returns: FFIType.void,
    },
    jove_Shape_SetFriction: {
      args: [FFIType.i32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Shape_GetFriction: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    jove_Shape_SetRestitution: {
      args: [FFIType.i32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Shape_GetRestitution: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    jove_Shape_SetDensity: {
      args: [FFIType.i32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_Shape_GetDensity: {
      args: [FFIType.i32],
      returns: FFIType.f32,
    },
    jove_Shape_SetFilter: {
      args: [FFIType.i32, FFIType.u16, FFIType.u16, FFIType.i16],
      returns: FFIType.void,
    },
    jove_Shape_GetFilter: {
      args: [FFIType.i32, FFIType.pointer, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Shape_GetBody: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },
    jove_Shape_GetType: {
      args: [FFIType.i32],
      returns: FFIType.i32,
    },

    /* ── Joints (still u64) ────────────────────────────────────── */
    jove_CreateDistanceJoint: {
      args: [FFIType.u32, FFIType.i32, FFIType.i32,
             FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_CreateRevoluteJoint: {
      args: [FFIType.u32, FFIType.i32, FFIType.i32,
             FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_CreatePrismaticJoint: {
      args: [FFIType.u32, FFIType.i32, FFIType.i32,
             FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32,
             FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_CreateWeldJoint: {
      args: [FFIType.u32, FFIType.i32, FFIType.i32,
             FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_CreateMouseJoint: {
      args: [FFIType.u32, FFIType.i32, FFIType.i32, FFIType.f32, FFIType.f32],
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
      returns: FFIType.i32,
    },
    jove_Joint_GetBodyB: {
      args: [FFIType.u64],
      returns: FFIType.i32,
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

    /* Wheel joint */
    jove_CreateWheelJoint: {
      args: [FFIType.u32, FFIType.i32, FFIType.i32,
             FFIType.f32, FFIType.f32, FFIType.f32, FFIType.f32,
             FFIType.f32, FFIType.f32, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_WheelJoint_EnableSpring: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_WheelJoint_SetSpringHertz: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_WheelJoint_GetSpringHertz: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_WheelJoint_SetSpringDampingRatio: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_WheelJoint_GetSpringDampingRatio: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_WheelJoint_EnableLimit: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_WheelJoint_SetLimits: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_WheelJoint_EnableMotor: {
      args: [FFIType.u64, FFIType.i32],
      returns: FFIType.void,
    },
    jove_WheelJoint_SetMotorSpeed: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_WheelJoint_SetMaxMotorTorque: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_WheelJoint_GetMotorTorque: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },

    /* Motor joint */
    jove_CreateMotorJoint: {
      args: [FFIType.u32, FFIType.i32, FFIType.i32, FFIType.f32, FFIType.i32],
      returns: FFIType.u64,
    },
    jove_MotorJoint_SetLinearOffset: {
      args: [FFIType.u64, FFIType.f32, FFIType.f32],
      returns: FFIType.void,
    },
    jove_MotorJoint_GetLinearOffset: {
      args: [FFIType.u64, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_MotorJoint_SetAngularOffset: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_MotorJoint_GetAngularOffset: {
      args: [FFIType.u64],
      returns: FFIType.f32,
    },
    jove_MotorJoint_SetMaxForce: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_MotorJoint_SetMaxTorque: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },
    jove_MotorJoint_SetCorrectionFactor: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.void,
    },

    /* Joint anchors & reactions */
    jove_Joint_GetAnchorA: {
      args: [FFIType.u64, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Joint_GetAnchorB: {
      args: [FFIType.u64, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Joint_GetReactionForce: {
      args: [FFIType.u64, FFIType.f32, FFIType.pointer, FFIType.pointer],
      returns: FFIType.void,
    },
    jove_Joint_GetReactionTorque: {
      args: [FFIType.u64, FFIType.f32],
      returns: FFIType.f32,
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
