let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

function draw() {
    // fill background
    ctx.fillStyle = state.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw grid
    draw_grid_walls(ctx);
    draw_grid_lines(ctx);

    // draw paths
    draw_waypoints(ctx);
    draw_paths(ctx);

    requestAnimationFrame(draw);
}
const trigger_pathfinding = () => [
    { ...path_find(), name: "default" },
    {
        ...path_find({ secondary: manhattan_distance }),
        name: "primary: default, waypoints: manhattan",
    },
    {
        ...path_find({ secondary: null }),
        name: "primary: default, waypoints: disabled",
    },
];

function init() {
    // set camera position to center of the grid
    state.camera.x = state.grid.width / 2;
    state.camera.y = state.grid.height / 2;

    // set zoom to fit the grid in the canvas
    state.camera.zoom = Math.min(
        (window.innerWidth - 60) / state.grid.width,
        (window.innerHeight - 60) / state.grid.height
    );
    state.camera.zoom = Math.min(Math.max(state.camera.zoom, state.camera.min_zoom), state.camera.max_zoom);
    fill_cells();

    resize(canvas);
    window.addEventListener("resize", () => resize(canvas));

    // zoom on scroll
    window.addEventListener("wheel", (e) => {
        let zoom_factor = 1.1;
        state.camera.zoom *= Math.pow(zoom_factor, e.deltaY / -120);
        state.camera.zoom = Math.min(Math.max(state.camera.zoom, state.camera.min_zoom), state.camera.max_zoom);
    });

    // set path start on left button down
    // set filling state on right button down
    window.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
            state.path_finding.start = camera_to_grid(e.clientX, e.clientY);

            if (e.ctrlKey) state.path_finding.waypoints = [];
        } else if (e.button === 2) {
            let { x, y } = camera_to_grid(e.clientX, e.clientY);
            state.filling = !state.grid.cells[x][y];
        }
    });

    // move on left click drag
    // set cells on right click drag
    // path finding on ctrl + left click drag
    window.addEventListener("mousemove", (e) => {
        if (e.buttons === 1) {
            if (e.ctrlKey) {
                let { x, y } = camera_to_grid(e.clientX, e.clientY);
                let { x: prev_end_x, y: prev_end_y } = state.path_finding.end;
                if (x !== prev_end_x || y !== prev_end_y) {
                    state.path_finding.end = { x, y };

                    // add new waypoint if distance to previous waypoint is greater than 0
                    if (
                        state.path_finding.waypoints.length === 0 ||
                        manhattan_distance({ x, y }, state.path_finding.waypoints.at(-1)) > 2
                    )
                        state.path_finding.waypoints.push({ x, y });

                    state.path_finding.paths = trigger_pathfinding();
                }
            } else {
                state.camera.x -= e.movementX / state.camera.zoom;
                state.camera.y -= e.movementY / state.camera.zoom;
            }
        } else if (e.buttons === 2) {
            let { x, y } = camera_to_grid(e.clientX, e.clientY);
            state.grid.cells[x][y] = state.filling;
        }
    });

    // set cells on right button up
    // end path finding on left button up
    window.addEventListener("mouseup", (e) => {
        if (e.button & 2) {
            let { x, y } = camera_to_grid(e.clientX, e.clientY);
            state.grid.cells[x][y] = state.filling;
        }
    });

    // avoid right click context menu
    window.addEventListener("contextmenu", (e) => e.preventDefault());

    // path find on load
    state.path_finding.start = { x: state.grid.width - 1, y: state.grid.height - 1 };
    state.path_finding.end = { x: 0, y: state.grid.height - 1 };
    state.path_finding.paths = trigger_pathfinding();

    draw();
}

window.addEventListener("load", init);
