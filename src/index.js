// https://unpkg.com/browse/@babylonjs/core@6.11.1/
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { Color4 } from "@babylonjs/core/Maths/math.color.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { ShadowGeneratorSceneComponent } from "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { Quaternion } from "@babylonjs/core/Maths/math.vector.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import "oimophysics";

async function init() {
    const canvas = document.getElementById("renderCanvas");
    const engine = new Engine(canvas, true);

    // This creates a basic Babylon Scene object (non-mesh)
    const scene = new Scene(engine);

    const world = new OIMO.World();

    // This creates and positions a free camera (non-mesh)
    const camera = new ArcRotateCamera("Camera", -Math.PI / 2, Math.PI / 2.5, 15, new Vector3(0, 0, 0), scene);
    camera.setTarget(Vector3.Zero()); // This targets the camera to scene origin
    camera.attachControl(canvas, true); // This attaches the camera to the canvas

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    const light = new DirectionalLight("Light", new Vector3(0, -8, 2), scene);
    light.intensity = 0.7; // Default intensity is 1. Let's dim the light a small amount

    const shadowGen = new ShadowGenerator(1024, light);

    // Our built-in 'sphere' shape.
    const sphere = MeshBuilder.CreateSphere("Sphere", { diameter: 2, segments: 32 }, scene);
    shadowGen.addShadowCaster(sphere);

    // Our built-in 'ground' shape.
    const ground = MeshBuilder.CreateBox("Ground", { width: 6, height: 0.1, depth: 6 }, scene);
    ground.addRotation(0, 0, 0.1);
    ground.receiveShadows = true;

    const groundMesh = scene.getMeshByName("Ground");
    const groundSizes = groundMesh.getBoundingInfo().maximum;
    const groundRBConfig = new OIMO.RigidBodyConfig();
    groundRBConfig.type = OIMO.RigidBodyType.STATIC;
    const groundRigidBody = new OIMO.RigidBody(groundRBConfig);
    const groundShapeConfig = new OIMO.ShapeConfig();
    groundShapeConfig.restitution = 0.8;
    groundShapeConfig.geometry = new OIMO.BoxGeometry(new OIMO.Vec3(
        groundSizes.x, groundSizes.y, groundSizes.z));
    groundRigidBody.addShape(new OIMO.Shape(groundShapeConfig));
    world.addRigidBody(groundRigidBody);

    const groundRotQ = groundMesh.rotation.toQuaternion();
    groundRigidBody.setOrientation(new OIMO.Quat(groundRotQ.x, groundRotQ.y, groundRotQ.z, groundRotQ.w));

    // Sphere:
    const sphereMesh = scene.getMeshByName("Sphere");
    const sphereBounding = sphereMesh.getBoundingInfo().maximum;

    const sphereRBConfig = new OIMO.RigidBodyConfig();
    sphereRBConfig.type = OIMO.RigidBodyType.DYNAMIC;
    sphereRBConfig.position = new OIMO.Vec3(2.5, 5, 0);
    const sphereShapeConfig = new OIMO.ShapeConfig();
    sphereShapeConfig.density = 1;
    sphereShapeConfig.restitution = 0.8;
    sphereShapeConfig.geometry = new OIMO.SphereGeometry(sphereBounding.y + .1); // add a little space so lines render outside of the sphere
    const sphereRigidBody = new OIMO.RigidBody(sphereRBConfig);
    sphereRigidBody.addShape(new OIMO.Shape(sphereShapeConfig));
    world.addRigidBody(sphereRigidBody);

    class DebugDrawer extends OIMO.DebugDraw {

        constructor() {
            super();
            this.lineSystem = null;
            this.debugColors = [];
            this.debugLines = [];
        }

        begin() {
            this.debugColors = [];
            this.debugLines = [];
        }

        line(from, to, color) {
            this.debugLines.push(new Vector3(from.x, from.y, from.z));
            this.debugLines.push(new Vector3(to.x, to.y, to.z));

            this.debugColors.push(new Color4(color.x, color.y, color.z, 1));
            this.debugColors.push(new Color4(color.x, color.y, color.z, 1));
        }

        end() {
            if (!this.linesystem) {
                this.linesystem = MeshBuilder.CreateLineSystem("linesystem", { lines: [this.debugLines], colors: [this.debugColors], updatable: true }, scene);
            } else {
                MeshBuilder.CreateLineSystem("line", { lines: [this.debugLines], instance: this.linesystem });
            }
        }
    }

    const debugDrawer = new DebugDrawer();
    debugDrawer.wireframe = true;
    world.setDebugDraw(debugDrawer);

    let currentTime, dt;
    let lastTime = Date.now();;

    // Update physics engine animation on Before Render
    let frame = 0;
    scene.onBeforeRenderObservable.add(() => {

        const spherePos = sphereRigidBody.getPosition();
        sphereMesh.setAbsolutePosition(new Vector3(
            spherePos.x, spherePos.y, spherePos.z
        ));

        const sphereRot = sphereRigidBody.getOrientation();
        sphereMesh.rotationQuaternion = new Quaternion(
            sphereRot.x,
            sphereRot.y,
            sphereRot.z,
            sphereRot.w
        );

        currentTime = Date.now();
        dt = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        world.step(dt);

        debugDrawer.begin();
        world.debugDraw();
        debugDrawer.end();

        // Reset the sphere every 350 frames
        if (frame >= 350) {
            sphereRigidBody.setPosition(new OIMO.Vec3(2.5, 5, 0));
            sphereRigidBody.setOrientation(new OIMO.Quat(0, 0, 0, 1));
            sphereRigidBody.setLinearVelocity(new OIMO.Vec3(0, 0, 0));
            sphereRigidBody.setAngularVelocity(new OIMO.Vec3(0, 0, 0));
            return frame = 0
        }

        frame++
    });

    window.onresize = () => {
        engine.resize();
    }

    engine.runRenderLoop(() => {
        scene.render();
    });
}

init();
