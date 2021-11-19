let state = {
    camera: {
        x: 0,
        y: 0,
        zoom: 10.0,
        min_zoom: 1.0,
        max_zoom: 128.0,
    },
    grid: {
        grid_line_width: 1 / 16,
        width: 128,
        height: 128,
        grid_line_color: "rgba(0, 0, 0, .5)",
        border_color: "rgba(0, 0, 0, 0.9)",
        wall_color: "rgba(100, 26, 7, .6)",
        cells: [],
        fill_threshold: 0.2,
        fill_scale: 40,
    },
    path_finding: {
        start: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
        way_points: [],
        promise: null,
        paths: [],
        way_point_color: "rgba(0, 0, 0, 0.5)",
        path_colors: [
            "hsla(0, 100%, 50%, .5)",
            "hsla(108, 100%, 50%, .5)",
            "hsla(216, 100%, 50%, .5)",
            "hsla(324, 100%, 50%, .5)",
            "hsla(72, 100%, 50%, .5)",
            "hsla(180, 100%, 50%, .5)",
            "hsla(288, 100%, 50%, .5)",
            "hsla(36, 100%, 50%, .5)",
            "hsla(144, 100%, 50%, .5)",
            "hsla(252, 100%, 50%, .5)",
            // "hsla(0, 100%, 50%, .5)",
            // "hsla(36, 100%, 50%, .5)",
            // "hsla(72, 100%, 50%, .5)",
            // "hsla(108, 100%, 50%, .5)",
            // "hsla(144, 100%, 50%, .5)",
            // "hsla(180, 100%, 50%, .5)",
            // "hsla(216, 100%, 50%, .5)",
            // "hsla(252, 100%, 50%, .5)",
            // "hsla(288, 100%, 50%, .5)",
            // "hsla(324, 100%, 50%, .5)",
        ],
        timeout: 12,
    },
    background: "rgb(230, 230, 230)",
    filling: false,
};

function resize(canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

const world_to_camera = (x, y) => ({
    x: (x - state.camera.x) * state.camera.zoom + canvas.width / 2,
    y: (y - state.camera.y) * state.camera.zoom + canvas.height / 2,
});

const camera_to_world = (x, y) => ({
    x: (x - canvas.width / 2) / state.camera.zoom + state.camera.x,
    y: (y - canvas.height / 2) / state.camera.zoom + state.camera.y,
});

const camera_to_grid = (x, y) => {
    let { x: grid_x, y: grid_y } = camera_to_world(x, y);
    return {
        x: Math.floor(grid_x),
        y: Math.floor(grid_y),
    };
};

function draw_grid_lines(ctx) {
    ctx.lineWidth = state.grid.grid_line_width * state.camera.zoom;

    // calculate firts line position
    let { x: grid_start_x, y: grid_start_y } = world_to_camera(0, 0);
    let { x: grid_end_x, y: grid_end_y } = world_to_camera(state.grid.width, state.grid.height);

    ctx.beginPath();
    ctx.strokeStyle = state.grid.grid_line_color;

    // draw vertical lines
    for (let i = 1; i < state.grid.width; i += 1) {
        let { x: line_x, y } = world_to_camera(i, 0);
        ctx.moveTo(line_x, grid_start_y);
        ctx.lineTo(line_x, grid_end_y);
    }

    // draw horizontal lines
    for (let j = 1; j < state.grid.height; j += 1) {
        let { x, y: line_y } = world_to_camera(0, j);
        ctx.moveTo(grid_start_x, line_y);
        ctx.lineTo(grid_end_x, line_y);
    }

    ctx.stroke();

    // draw grid border
    ctx.beginPath();
    ctx.strokeStyle = state.grid.border_color;

    ctx.moveTo(grid_start_x, grid_start_y - (state.grid.grid_line_width * state.camera.zoom) / 2);
    ctx.lineTo(grid_start_x, grid_end_y);
    ctx.lineTo(grid_end_x, grid_end_y);
    ctx.lineTo(grid_end_x, grid_start_y);
    ctx.lineTo(grid_start_x, grid_start_y);

    ctx.stroke();
}

function draw_grid(ctx, grid, color) {
    ctx.beginPath();
    ctx.fillStyle = color;

    for (let i = 0; i < grid.length; i += 1)
        for (let j = 0; j < grid[i].length; j += 1)
            if (grid[i][j]) {
                let { x, y } = world_to_camera(i, j);
                ctx.fillRect(x, y, state.camera.zoom, state.camera.zoom);
            }

    ctx.fill();
}

function draw_grid_walls(ctx) {
    draw_grid(ctx, state.grid.cells, state.grid.wall_color);
}

function draw_cells(ctx, cells, color) {
    ctx.beginPath();
    ctx.fillStyle = color;

    for (let cell of cells) {
        let { x, y } = world_to_camera(cell.x, cell.y);
        ctx.fillRect(x, y, state.camera.zoom, state.camera.zoom);
    }

    ctx.fill();
}

let get_direction = (a, b) => {
    if (b === undefined) debugger;
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const directions = [
        [null, 0, null], // up-left, up, up-right
        [1, null, 3], // left, center, right
        [null, 2, null], // down-left, down, down-right
    ];

    return directions[dy + 1][dx + 1];
};

function draw_paths(ctx) {
    let legends = [];
    let text_length = 0;
    let path_count = state.path_finding.paths.length;
    let path_line_width = 1 / path_count;
    ctx.lineWidth = path_line_width * state.camera.zoom;
    // set font on top so text length can be calculated correctly
    ctx.font = "16px Roboto, Arial, sans-serif";

    // draw paths
    for (let i = 0; i < path_count; i += 1) {
        let { path, name } = state.path_finding.paths[i];
        // if path is smaller than 2 points, skip it
        if (path.length < 2) continue;
        let color = state.path_finding.path_colors[i % state.path_finding.path_colors.length];

        ctx.beginPath();
        ctx.strokeStyle = color;
        let { x: start_x, y: start_y } = path[0];
        let out_direction = get_direction(path[0], path[1]);

        if (out_direction == 0) {
            start_x += (i + 0.5) * path_line_width;
            start_y += 1;
        } else if (out_direction == 1) {
            start_x += 1;
            start_y += (path_count - i - 0.5) * path_line_width;
        } else if (out_direction == 2) {
            start_x += (path_count - i - 0.5) * path_line_width;
        } else if (out_direction == 3) {
            start_y += (i + 0.5) * path_line_width;
        }

        // convert to camera coordinates
        let { x: start_x_camera, y: start_y_camera } = world_to_camera(start_x, start_y);
        ctx.moveTo(start_x_camera, start_y_camera);
        for (let j = 1; j < path.length - 1; j += 1) {
            let { x: a_x, y: a_y } = path[j];
            let in_direction = get_direction(path[j - 1], path[j]);
            let out_direction = get_direction(path[j], path[j + 1]);
            let rotation = out_direction - in_direction;
            if (rotation < 0) rotation += 4;

            // if we have not rotated, skip the cell
            if (rotation === 0) continue;
            if (rotation === 1) {
                if (in_direction === 0) {
                    a_x += (i + 0.5) * path_line_width;
                    a_y += (path_count - i - 0.5) * path_line_width;
                } else if (in_direction === 1) {
                    a_x += (path_count - i - 0.5) * path_line_width;
                    a_y += (path_count - i - 0.5) * path_line_width;
                } else if (in_direction === 2) {
                    // correct
                    a_x += (path_count - i - 0.5) * path_line_width;
                    a_y += (i + 0.5) * path_line_width;
                } else if (in_direction === 3) {
                    a_x += (i + 0.5) * path_line_width;
                    a_y += (i + 0.5) * path_line_width;
                }
            } else if (rotation === 3) {
                if (in_direction === 0) {
                    // correct
                    a_x += (i + 0.5) * path_line_width;
                    a_y += (i + 0.5) * path_line_width;
                } else if (in_direction === 1) {
                    // correct
                    a_x += (i + 0.5) * path_line_width;
                    a_y += (path_count - i - 0.5) * path_line_width;
                } else if (in_direction === 2) {
                    a_x += (path_count - i - 0.5) * path_line_width;
                    a_y += (path_count - i - 0.5) * path_line_width;
                } else if (in_direction === 3) {
                    // correct
                    a_x += (path_count - i - 0.5) * path_line_width;
                    a_y += (i + 0.5) * path_line_width;
                }
            }

            let { x, y } = world_to_camera(a_x, a_y);
            ctx.lineTo(x, y);
        }

        let { x: end_x, y: end_y } = path[path.length - 1];
        let in_direction = get_direction(path[path.length - 2], path[path.length - 1]);

        if (in_direction === 0) {
            end_x += (i + 0.5) * path_line_width;
        } else if (in_direction === 1) {
            end_y += (path_count - i - 0.5) * path_line_width;
        } else if (in_direction === 2) {
            end_x += (path_count - i - 0.5) * path_line_width;
            end_y += 1;
        } else if (in_direction === 3) {
            end_x += 1;
            end_y += (i + 0.5) * path_line_width;
        }

        let { x: end_x_camera, y: end_y_camera } = world_to_camera(end_x, end_y);
        ctx.lineTo(end_x_camera, end_y_camera);

        ctx.stroke();

        legends.push({ color, name });
        text_length = Math.max(text_length, ctx.measureText(name).width);
    }

    // draw legends
    let line_width = state.grid.grid_line_width * 24;
    let cell_width = 24 - line_width;
    let legend_y = 8;
    ctx.beginPath();

    // white background for better visibility
    ctx.fillStyle = "rgba(255, 255, 255, .8)";
    ctx.fillRect(0, legend_y - 4, text_length + 48, 32 * legends.length);
    for (let { color, name } of legends) {
        // draw sample cell for this path
        ctx.strokeStyle = state.grid.grid_line_color;
        ctx.lineWidth = line_width;
        ctx.fillStyle = color;
        ctx.strokeRect(8 + line_width / 2, legend_y + line_width / 2, cell_width, cell_width);
        ctx.fillRect(8 + line_width / 2, legend_y + line_width / 2, cell_width, cell_width);

        // draw legend text
        ctx.fillStyle = "black";
        ctx.fillText(name, 40, legend_y + 18);

        legend_y += 32;
    }

    ctx.fill();
    ctx.stroke();
}

function draw_way_points(ctx) {
    draw_cells(ctx, state.path_finding.way_points, state.path_finding.way_point_color);
}

function fill_cells() {
    noise.seed(Math.random());

    for (let i = 0; i < state.grid.width; i += 1) {
        state.grid.cells[i] = [];

        for (let j = 0; j < state.grid.height; j += 1) {
            state.grid.cells[i][j] =
                noise.simplex2(i / state.grid.fill_scale, j / state.grid.fill_scale) > state.grid.fill_threshold;
        }
    }
}

const manhattan_distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const euclidean_distance = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
const square_distance = (a, b) => Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);

function path_find(heuristics) {
    let path = [];

    heuristics = {
        primary: manhattan_distance,
        secondary: square_distance,
        ...heuristics,
    };

    // using A* algorithm
    // cannot move diagonally
    // walls are stored in state.grid.cells
    let grid_state = []; // grid_state[x][y] = { x, y, g, h, f, w, parent, open }
    // w is the distance to closest way point
    for (let i = 0; i < state.grid.width; i += 1) grid_state[i] = [];
    grid_state[state.path_finding.start.x][state.path_finding.start.y] = {
        x: state.path_finding.start.x,
        y: state.path_finding.start.y,
        g: 0,
        h: 0,
        f: 0,
        w: 0,
        parent: null,
        open: true,
    };

    // open set is sorted by f value in ascending order and w value in ascending order
    // f has higher priority than w
    // open_set[i] = grid_state[x][y]
    let open_set = [grid_state[state.path_finding.start.x][state.path_finding.start.y]];

    // copy way points
    let way_points = [...state.path_finding.way_points];

    // using d3 bisector to keep the open set sorted
    // comparator should value f more than w
    const bisector = d3.bisector((a, b) => {
        let order = d3.ascending(a.f, b.f);
        return order ? order : d3.ascending(a.w, b.w);
    }).left;

    while (open_set.length > 0) {
        let current = open_set.shift();
        current.open = false;

        // if this is the end cell, we're done
        if (current.x === state.path_finding.end.x && current.y === state.path_finding.end.y) {
            // backtrack path
            while (current) {
                path.push(current);
                current = current.parent;
            }
            break;
        }

        // list all neighbors
        let neighbors = [
            { x: current.x - 1, y: current.y, cost: 1 },
            { x: current.x + 1, y: current.y, cost: 1 },
            { x: current.x, y: current.y - 1, cost: 1 },
            { x: current.x, y: current.y + 1, cost: 1 },
        ];

        for (let neighbor of neighbors) {
            if (neighbor.x < 0 || neighbor.x >= state.grid.width || neighbor.y < 0 || neighbor.y >= state.grid.height)
                continue; // if cant go to neighbor, skip

            if (state.grid.cells[neighbor.x][neighbor.y]) continue; // if neighbor is a wall, skip

            let { x, y, cost } = neighbor;
            let g = current.g + cost; // cost of moving to neighbor

            // check if neighbor is visitedn and eighbor is visited but g is higher, skip
            // if (grid_state[x][y]) {
            //     if (g >= grid_state[x][y].g) continue;
            //     if (g === grid_state[x][y].g && grid_state[x][y].w >= current.w) continue;
            // }
            if (grid_state[x][y] && g >= grid_state[x][y].g) continue;

            // if state is undefined, add it to grid_state
            let h = heuristics.primary(state.path_finding.end, neighbor);

            let f = g + h;
            let w = Infinity;
            if (heuristics.secondary) {
                // calculate distance to closest way point
                // and index of closest way point
                let index = way_points.reduce((best_index, way_point, index) => {
                    let distance = heuristics.secondary(way_point, neighbor);

                    if (distance < w) {
                        w = distance;
                        return index;
                    }

                    return best_index;
                }, -1);

                // cut way points until closest way point
                way_points.splice(0, index);
            }
            grid_state[x][y] = { x, y, g, f, h, w, parent: current, open: true };
            let index = bisector(open_set, { f, w });
            open_set.splice(index, 0, grid_state[x][y]);
        }
    }

    return { path, grid_state };
}
