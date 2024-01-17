const canvas = document.getElementById("mainCanvas");
const ctx = canvas.getContext("2d");

var damages = 0; //number of infected cells

/*
There will be several rooms:

Lungs (Zoom in Alveoli)
Bloodstream (the small part that gets the vaccine)
Lymph node 1 (with the T-cells)
Lymph node 2 (with the Memory T-cells)


Cells will be circular

types of Cells:

Macrophage
Dentritic Cells
Epithelial Cells
Natural Killer Cells*
Helper T-Cells*
Killer T-Cells
Memory Cells

*optional

Particle Effects:
Interferons
Pyrogens*

*/

function FillPolygon(x, y, sides, radius, rotate){
	ctx.beginPath();
	const angle = Math.PI * 2 / sides;
	ctx.moveTo(x, y);
	for (let i = 0; i <= sides; i++){
		ctx.lineTo(x + Math.cos(angle*i + rotate) * radius, y + Math.sin(angle*i + rotate) * radius);
	}
	ctx.fill();
	ctx.closePath();
}

function Distances(object1, object2){ //do not use for wall cells
	const dx = object1.xpos - object2.xpos; const dy = object1.ypos - object2.ypos;
	const dist = Math.sqrt(dx**2 + dy**2);
	return [dx, dy, dist];
}

function GreedyBestFirstSearch(currentpoint, endpoint, field, usedpoints){//field will always be 19x12
	let myusedpoints = usedpoints;
	let distanceOrder = [];
	for (const [i, j] of [[0, 1], [1, 0], [0, -1], [-1, 0]]){
		const x = currentpoint[0] + i;
		const y = currentpoint[1] + j;
		try {
			if (!field[y][x] && !myusedpoints[y][x]){
				const dist = Math.abs(x - endpoint[0]) + Math.abs(y - endpoint[1]);
				distanceOrder.push([dist, [x, y]]);
				myusedpoints[y][x] = true;
			}
		} catch (err){}
	}
	distanceOrder.sort();
	for (const trypoint of distanceOrder){
		if (trypoint[0] == 0){
			return [trypoint[1]];
		} else {
			let nextFront = GreedyBestFirstSearch(trypoint[1], endpoint, field, myusedpoints);//recursion forwards to the next frontier
			if (nextFront){
				nextFront.push(trypoint[1]);
				return nextFront;
			}
		}
	}
}

function Pathfind(startingpoint, endpoint, field){ //field is a 2d array with all the wall cells
	const begin = [Math.round(startingpoint[0] / 50), Math.round(startingpoint[1] / 50)];
	const end = [Math.round(endpoint[0] / 50), Math.round(endpoint[1] / 50)];
	const sequence = GreedyBestFirstSearch(begin, end, field, [[], []]);
	sequence.reverse();
	for (let [x, y] of sequence){
		[x, y] = [x * 50, y * 50];
	}
	return sequence;
}

class Particle {
	constructor(xpos, ypos) {
		this.xpos = xpos;
		this.ypos = ypos;
		this.xvel = Math.random() - 0.5;
		this.yvel = Math.random() - 0.5;
		this.born = new Date().getTime() + Math.random() * 4000;
	}
	randomize(xpos, ypos){
		this.xpos = xpos;
		this.ypos = ypos;
		this.xvel = Math.random() - 0.5;
		this.yvel = Math.random() - 0.5;
		this.born = new Date().getTime() + Math.random() * 4000;
	}
}

class Virus {
	constructor(xpos, ypos) {
		this.xpos = xpos;
		this.ypos = ypos;
		this.xvel = 0;
		this.yvel = 0;
		this.exists = true;
		this.armed = true;
	}
}

class Interferon {
	constructor(xpos, ypos, timerange) {
		this.xpos = xpos;
		this.ypos = ypos;
		this.xvel = (Math.random() - 0.5) * 2;
		this.yvel = (Math.random() - 0.5) * 2;
		this.born = new Date().getTime() + Math.random() * timerange;
	}
}

class Antigen {
	constructor(xpos, ypos){
		this.xpos = xpos;
		this.ypos = ypos;
		this.xvel = (Math.random() - 0.5) * 0.5;
		this.yvel = (Math.random() - 0.5);
		this.born = new Date().getTime() + Math.random() * 30000;
		this.exists = true;
	}
}

class Rect {
	constructor(xpos, ypos, width, height, color, particleColor, particleCount) {
		this.xpos = xpos;
		this.ypos = ypos;
		this.height = height;
		this.width = width;
		this.color = color;
		this.particles = []; //a particle is a dot, radius 5, that floats around then disappears
		this.particleColor = particleColor;
		for (let i = 0; i < particleCount; i++) {
			this.particles.push(new Particle(this.xpos + Math.random() * this.width, this.ypos + Math.random() * this.height));
		}
	}
	draw() {
		ctx.fillStyle = this.color;
		ctx.fillRect(this.xpos, this.ypos, this.width, this.height);
		ctx.fillStyle = this.particleColor;
		for (const p of this.particles) {
			ctx.beginPath();
			ctx.ellipse(p.xpos, p.ypos, 5, 5, 0, 0, 7);
			ctx.fill();
			ctx.closePath();
			p.xpos += p.xvel;
			p.ypos += p.yvel;

			if (new Date().getTime() - p.born > 3000) {
				p.randomize(this.xpos + Math.random() * this.width, this.ypos + Math.random() * this.height);
			}
		}
	}
}

class Room {
	constructor(type) {
		this.type = type;
		this.connections = null; //connections to other rooms, [side of exit (left, right, up, down) , connection to another area]
		this.wallInnerColor = null;
		this.wallOuterColor = null;
		this.walls = []; //Epithelial Cells
		this.cells = []; //Mobile Cells
		this.rects = []; //Rect {color, xpos, ypos, height, width, particles}
		this.viruses = []; //COVID
		this.antigens = []; //just the vaccine
		this.interferons = [];
		this.matrix = [];
	}
	tick() {
		//all physics
		const newcells = [];
		for (let cell of this.cells) {
			cell.xpos += cell.xvel;
			cell.ypos += cell.yvel;
			cell.xvel *= 0.8;
			cell.yvel *= 0.8;
		}

		for (let i in this.cells) {
			let keep = !this.cells[i].selfdestruct; //whether to keep the cell inside this specific room. 
			for (let j = 0; j < i; j++) {
				let cell1 = this.cells[i];
				let cell2 = this.cells[j];
				const minDist = cell1.radius + cell2.radius;
				const dx = cell1.xpos - cell2.xpos; const dy = cell1.ypos - cell2.ypos;
				const dist = Math.sqrt(dx ** 2 + dy ** 2);
				const pushback = minDist - dist;
				if (pushback > 0) {
					const angle = Math.atan2(dy, dx); 
					const pushx = Math.cos(angle) * pushback; const pushy = Math.sin(angle) * pushback;
					cell1.xvel += pushx; cell1.yvel += pushy;
					cell2.xvel -= pushx; cell2.yvel -= pushy;
				}
			}
			for (const wall of this.walls) { //im lazy
				let cell = this.cells[i];
				const dx = cell.xpos - (wall.xpos + 25); const dy = cell.ypos - (wall.ypos + 25);
				const dist = Math.sqrt(dx ** 2 + dy ** 2);
				const pushback = Math.max(0, cell.radius + 30 - dist);
				cell.xvel += Math.tanh(dx) * pushback; cell.yvel += Math.tanh(dy) * pushback;
			}
			
			//handles collisions with edges
			let cell = this.cells[i];
			if (cell.xpos < -cell.radius){
				const nextScreen = this.connections.left;
				if (nextScreen && cell.cancross){
					[cell.xpos, cell.ypos] = nextScreen.pos;
					nextScreen.room.cells.push(cell);
					keep = false;
				} else {
					cell.xvel = Math.abs(cell.xvel);
					cell.xpos = -cell.radius;
				}
			} else if (cell.xpos > 950 + cell.radius){
				const nextScreen = this.connections.right;
				if (nextScreen && cell.cancross){
					[cell.xpos, cell.ypos] = nextScreen.pos;
					nextScreen.room.cells.push(cell);
					keep = false;
				} else {
					cell.xvel = -Math.abs(cell.xvel);
					cell.xpos = 950 + cell.radius;
				}
			} else if (cell.ypos < -cell.radius){
				const nextScreen = this.connections.up;
				if (nextScreen && cell.cancross){
					[cell.xpos, cell.ypos] = nextScreen.pos;
					nextScreen.room.cells.push(cell);
					keep = false;
				} else {
					cell.yvel = Math.abs(cell.yvel);
					cell.ypos = -cell.radius;
				}
			} else if (cell.ypos > 600 + cell.radius){
				const nextScreen = this.connections.down;
				if (nextScreen && cell.cancross){
					[cell.xpos, cell.ypos] = nextScreen.pos;
					nextScreen.room.cells.push(cell);
					keep = false;
				} else {
					cell.yvel = -Math.abs(cell.yvel);
					cell.ypos = 600 + cell.radius;
				}
			}
			if (keep){
				newcells.push(cell);
			}
		}
		this.cells = newcells;
		//run cell AI
		for (const cell of this.cells) {
			cell.tick(this);
		}

		for (const cell of this.walls){
			cell.tick();
		}

		{ //Walls
			let newwalls = [];
			for (let wall of this.walls) {
				let minDist = 100; //minimum distance of a virus; therefore closest virus
				for (let virus of this.viruses) {

					const dx = wall.xpos + 25 - virus.xpos; const dy = wall.ypos + 25 - virus.ypos;
					const dist = Math.sqrt(dx ** 2 + dy ** 2);
					if (dist < 25 && !wall.ready) {
						virus.exists = false;
						wall.sick = true;
						wall.sickTime = new Date().getTime() + Math.random() * 500;
						wall.interferonTime = new Date().getTime();
					} else if (dist < minDist) {
						wall.interest = virus;
						minDist = dist;
					}
				}
				if (!wall.sick && !wall.ready){
					for (let iferon of this.interferons){
						const dx = wall.xpos + 25 - iferon.xpos; const dy = wall.ypos + 25 - iferon.ypos;
						const dist = Math.sqrt(dx ** 2 + dy ** 2);
						if (dist < 25) {
							iferon.born = 0;
							wall.ready = true;
							wall.readyTime = new Date().getTime() + Math.random() * 500;
							wall.interest = {xpos: iferon.xpos, ypos: iferon.ypos};
						}
					}
				}
				
				if (wall.sick){
					if (new Date().getTime() - wall.interferonTime > 1000){
						wall.interferonTime = new Date().getTime();
						let newiferon = new Interferon(wall.xpos + 25, wall.ypos + 25, 4000);
						this.interferons.push(newiferon);
					}
				}
				
				switch (wall.sta){
					case "alive":
						newwalls.push(wall);
						break;
					case "lysis":
						for (let i = 0; i < 4; i++){
							let newvirus = new Virus(wall.xpos + 25, wall.ypos + 25);
							newvirus.xvel = (Math.random() - 0.5) * 10;
							newvirus.yvel = (Math.random() - 0.1) * -10;
							this.viruses.push(newvirus);
							damages++;
						}
						break;
					case "Apoptosis":
						damages++;
						break;
				}
			}
			this.walls = newwalls;
		}
		{ //Viruses
			let newviruses = [];
			for (let virus of this.viruses){
				let keep = virus.exists;
				virus.xpos += virus.xvel;
				virus.ypos += virus.yvel;
				virus.yvel += 0.2;
				virus.yvel *= 0.95;
				
				//transfer between rooms
				
				if (virus.ypos > 600){
					const nextScreen = this.connections.down;
					if (nextScreen){
						[virus.xpos, virus.ypos] = nextScreen.pos;
						nextScreen.room.viruses.push(virus); //replace with an antigen of the same position
					}
					keep = false;
				}			
				
				if (keep){
					newviruses.push(virus);
				}
			}
			this.viruses = newviruses;
		}
		{ //Antigens
			let newantigens = [];
			for (const antigen of this.antigens){
				antigen.xpos += antigen.xvel;
				antigen.ypos += antigen.yvel;
				if (new Date().getTime() - antigen.born < 30000 && antigen.exists){
					newantigens.push(antigen);
				}
			}
			this.antigens = newantigens;
		}
		{ //Interferons
			let newiferons = [];
			for (let iferon of this.interferons){
				iferon.xpos += iferon.xvel;
				iferon.ypos += iferon.yvel;
				if (new Date().getTime() - iferon.born < 5000){
					newiferons.push(iferon);
				} else {
					this.spreadIferon(this.connections.left);
					this.spreadIferon(this.connections.right);
					this.spreadIferon(this.connections.up);
					this.spreadIferon(this.connections.down);
				}
			}
			this.interferons = newiferons;
			
		}
	}
	draw() {
		//background
		ctx.save();
		ctx.fillStyle = "#020277";
		ctx.fillRect(0, 0, 960, 660);
		//rect backgrounds
		for (const r of this.rects) {
			r.draw();
		}

		for (const cell of this.cells) {//Mobile cells
			cell.draw();
		}

		for (const cell of this.walls) {//Epithelial cells
			cell.draw(this.wallInnerColor, this.wallOuterColor);
		}

		for (const virus of this.viruses){//viruses
			ctx.beginPath();
			ctx.fillStyle = "#FF0000";
			ctx.ellipse(virus.xpos, virus.ypos, 5, 5, 0, 0, 7);
			ctx.fill();
			ctx.closePath();
		}
		
		for (const antigen of this.antigens){
			ctx.beginPath();
			ctx.strokeStyle = "#FF0000";
			ctx.ellipse(antigen.xpos, antigen.ypos, 5, 5, 0, 0, 7);
			ctx.stroke();
			ctx.closePath();
		}
		
		for (const iferon of this.interferons){//inferferons
			ctx.beginPath();
			ctx.fillStyle = "#00FF00";
			ctx.ellipse(iferon.xpos, iferon.ypos, 5, 5, 0, 0, 7);
			ctx.fill();
			ctx.closePath();
		}

		ctx.restore();
	}
	spreadIferon(nextScreen){ //connections.left, etc
		if (nextScreen && Math.random() > 0.8){
			const room = nextScreen.room;
			const [newxpos, newypos] = nextScreen.pos;
			room.interferons.push(new Interferon(newxpos, newypos, 5000));
		}
	}
}

class WallCell { //wall cells are 50x50px blocks that can do stuff and be infected
	constructor(xpos, ypos) {
		this.xpos = xpos;
		this.ypos = ypos;
		this.ndir = [0, 0]; //tanh(x, y) of whatever it's interested in
		this.sick = false; //if infected
		this.interest = null;
		this.sickTime = null; //set to new Date.getTime() when infected
		this.sta = "alive";
		this.interferonTime = null; 
		this.ready = false; this.readyTime = null;
	}
	tick() {
		
		if (this.interest){
			if (this.interest.exists){
				const inter = this.interest;
				const dx = this.xpos + 25 - inter.xpos; const dy = this.ypos + 25 - inter.ypos;
				this.ndir = [(Math.tanh(-dx/10) + this.ndir[0])/2, (Math.tanh(-dy/10) + this.ndir[1])/2];
			} else {
				this.interest = null;
			}
		}
		if (this.sick){
			if (new Date().getTime() - this.sickTime > 30000){
				this.sta = "lysis"; //died via lysis
			}	
		}
		if (this.ready){
			if (new Date().getTime() - this.readyTime > 10000){
				this.ready = false;
			}
		}
		
	}
	debugdraw() {
		const x = this.xpos; const y = this.ypos;
		ctx.save();
		ctx.fillStyle = "#00FF00";
		ctx.fillRect(x, y, 50, 50);
		ctx.restore();
	}
	draw(color, wallcolor) {
		const x = this.xpos; const y = this.ypos;
		ctx.save();
		ctx.fillStyle = wallcolor;
		ctx.fillRect(x, y, 50, 50);
		ctx.fillStyle = color;
		if (this.sick){
			ctx.fillStyle = "#AAA202";
		} else if (this.ready){
			ctx.fillStyle = "#6262AA";
		}
		ctx.fillRect(x + 5, y + 5, 40, 40);
		//nucleus
		ctx.beginPath();
		ctx.fillStyle = "#AA00AA";
		const [lookx, looky] = this.ndir;
		ctx.ellipse(x + 25 + lookx * 5, y + 25 + looky * 5, 10, 10, 0, 0, 7);
		ctx.fill();
		ctx.closePath();

		ctx.restore();
	}
}

function WallCollection(a) { //takes a list and turns it into a collection of WallCells
	let ans = [];
	for (const pos of a) {
		ans.push(new WallCell(pos[0] * 50, pos[1] * 50));
	}
	return ans;
}

const rgbToHex = (color) => {
	const r = color[0];
	const g = color[1];
	const b = color[2];
	return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

class MobileCell {
	constructor(xpos, ypos) {
		this.xpos = xpos;
		this.ypos = ypos;
		this.xvel = 0;
		this.yvel = 0;
		this.direction = 0;
		this.ndir = [0, 0]; //direction of interest, magnitude
		this.interest = null;//select an interesting cell based on tick()
		this.cancross = false; //whether the cell can cross connections
		this.selfdestruct = false;
	}
	orientnuclei(ang, mag) {
		this.ndir[1] = (this.ndir[1] + mag) / 2;
		this.ndir[0] = ang;
	}
}

class Kcell extends MobileCell {//remember to code the AI further
	constructor(xpos, ypos) {
		super(xpos, ypos);
		this.radius = 20;
		this.type = [Math.round(Math.random() * 255), Math.round(Math.random() * 255), Math.round(Math.random() * 255)]
		this.goal = "Virgin";
		this.type1 = "Kcell";
		this.timer = 0;
		this.color = rgbToHex(this.type);
		this.multiplyIterations = 0;
		this.memory = false;
	}
	tick(room){
		let walls = room.walls;
		let cells = room.cells;
		let viruses = room.viruses.concat(room.antigens);
		let interferons = room.interferons;
		let dx = 0; let dy = 0; let dist = 0; let angle = 0;
		switch (this.goal) {
			case "Virgin":
				dx = this.xpos - 475; dy = this.ypos - 300;
				dist = Math.sqrt(dx**2 + (1.5 * dy)**2);
				if (dist > 300){
					this.xvel -= Math.tanh(dx);
					this.yvel -= Math.tanh(dy);
				}
				this.xvel += Math.tanh(dy * 0.01) * 0.3; //orbit the center
				this.yvel -= Math.tanh(dx * 0.01) * 0.2; //orbit center
				for (let iferon of interferons){
					[dx, dy, dist] = Distances(this, iferon);
					if (dist < this.radius){
						const angle = Math.atan2(-dy, -dx);
						this.ndir[0] = angle;
						this.ndir[1] = 5;
						this.xvel += 5 * Math.cos(angle);
						this.yvel += 5 * Math.sin(angle);
						iferon.born = 0;
						break;
					}
				}
				if (this.color == "#FF0000"){
					for (const cell of cells){
						if (cell.type1 == "DentriticCell" && cell.covered){
							[dx, dy, dist] = Distances(this, cell);
							if (dist - 10 < this.radius + cell.radius){
								this.goal = "Multiply";
								cell.goal = "Die";
								cell.timer = new Date().getTime();
								this.timer = new Date().getTime();
								break;
							}
						}
					}
				}
				break;
			case "Multiply":
				this.orientnuclei(0, 0);
				const newtime = new Date().getTime()
				if (this.multiplyIterations > 3){
					if (Math.random() < 0.7){
						this.goal = "Task";
						this.cancross = true;
					} else {
						this.goal = "MemoryWait";
						this.memory = true;
					}
				} else if (newtime - this.timer > 1000){
					this.timer = newtime;
					this.multiplyIterations++;
					let newcell = new Kcell(this.xpos + Math.random() * 20, this.ypos + Math.random() * 20);
					newcell.type = this.type;
					newcell.color = this.color;
					newcell.goal = "Multiply";
					newcell.timer = newtime;
					newcell.multiplyIterations = this.multiplyIterations;
					newcell.memory = this.memory;
					cells.push(newcell);
				}
				break;
			case "Task":
				this.ndir[1] /= 2;
				let HeadX = 0; let HeadY = 0;
				if (interferons.length == 0){
					this.goal = "Prepare To Die";
					this.timer = new Date().getTime();
					break;
				}
				for (const iferon of interferons){
					[dx, dy, dist] = Distances(this, iferon);
					if (dist != 0){
						dist = Math.max(this.radius, dist);
						angle = Math.atan2(-dy, -dx);
						HeadX += Math.cos(angle) * 99999 / dist;
						HeadY += Math.sin(angle) * 99999 / dist;
					}
				}
				this.xvel += Math.tanh(HeadX);
				this.yvel += Math.tanh(HeadY);
				
				for (const cell of cells){
					if (cell.type1 == "Kcell" && cell.goal == "Task"){
						[dx, dy, dist] = Distances(this, cell);
						if (dist != 0){
							angle = Math.atan2(dy, dx);
							this.xvel += Math.cos(angle) * 25/ dist;
							this.yvel += Math.sin(angle) * 25/ dist;
						}
					}
				}
				
				let minDist = 120;
				for (const wall of walls){
					if (wall.sick){
						dx = this.xpos - wall.xpos - 25; dy = this.ypos - wall.ypos - 25;
						dist = Math.sqrt(dx**2 + dy**2);
						
						if (dist < minDist){
							minDist = dist;
							this.interest = wall;
							this.goal = "Inspect";
							this.timer = new Date().getTime();
						}
					}
				}
				
				break;
			case "Inspect":
				if (new Date().getTime() - this.timer > 3000 || !(this.interest.sta == "alive")){
					this.goal = "Task";
					this.interest = null;
					break;
				}
				dx = this.xpos - this.interest.xpos - 25; dy = this.ypos - this.interest.ypos - 25;
				dist = Math.sqrt(dx**2 + dy**2);
				angle = Math.atan2(-dy, -dx);
				this.orientnuclei(angle, 3);
				if (dist < this.radius + 32){
					this.goal = "Terminate";
					this.timer = new Date().getTime();
				} else {
					this.xvel += Math.cos(angle);
					this.yvel += Math.sin(angle);
				}
				break;
			case "Terminate":
				dx = this.xpos - this.interest.xpos - 25; dy = this.ypos - this.interest.ypos - 25;
				dist = Math.sqrt(dx**2 + dy**2);
				angle = Math.atan2(-dy, -dx);
				this.xvel += Math.cos(angle);
				this.yvel += Math.sin(angle);
				this.orientnuclei(angle, 3);
				if (new Date().getTime() - this.timer > 1500){
					this.interest.sta = "Apoptosis";
					this.interest = null;
					this.goal = "Task";
				}
				break;
			case "MemoryWait":
				dx = this.xpos - 475; dy = this.ypos - 300;
				dist = Math.sqrt(dx**2 + (1.5 * dy)**2);
				if (dist > 200){
					this.xvel -= Math.tanh(dx);
					this.yvel -= Math.tanh(dy);
				}
				this.xvel += Math.tanh(dy * 0.01) * 0.3; //orbit the center
				this.yvel -= Math.tanh(dx * 0.01) * 0.2; //orbit center
				if (interferons.length == 0){
					this.goal = "Memory";
				}
				break;
			case "Memory":
				dx = this.xpos - 475; dy = this.ypos - 300;
				dist = Math.sqrt(dx**2 + (1.5 * dy)**2);
				if (dist > 200){
					this.xvel -= Math.tanh(dx);
					this.yvel -= Math.tanh(dy);
				}
				this.xvel += Math.tanh(dy * 0.01) * 0.3; //orbit the center
				this.yvel -= Math.tanh(dx * 0.01) * 0.2; //orbit center
				if (this.color == "#FF0000"){
					let minDist = 200;
					for (const virus of viruses){
						[dx, dy, dist] = Distances(this, virus);
						if (dist < minDist){
							minDist = dist;
							this.interest = virus;
							this.goal = "MemoryAwake";
							this.timer = new Date().getTime();
						}
					}
				}
				break;
			case "MemoryAwake":
				if (!this.interest.exists){
					this.goal = "Memory";
					this.interest = null;
					break;
				}
				[dx, dy, dist] = Distances(this, this.interest);
				if (dist < this.radius){
					this.interest.exists = false;
					this.interest = null;
					this.goal = "Multiply";
					this.multiplyIterations = 0;
					break;
				}
				angle = Math.atan2(-dy, -dx);
				this.xvel += Math.cos(angle);
				this.yvel += Math.sin(angle);
				this.orientnuclei(angle, 3);
				break;
			case "TissueResident":
				{
					let HeadX = 0; let HeadY = 0;
					for (const iferon of interferons){
						[dx, dy, dist] = Distances(this, iferon);
						if (dist != 0){
							dist = Math.max(this.radius, dist);
							angle = Math.atan2(-dy, -dx);
							HeadX += Math.cos(angle) * 99999 / dist;
							HeadY += Math.sin(angle) * 99999 / dist;
						}
					}
					this.xvel += Math.tanh(HeadX);
					this.yvel += Math.tanh(HeadY);
					let minDist = 120;
					for (const wall of walls){
						if (wall.sick){
							dx = this.xpos - wall.xpos - 25; dy = this.ypos - wall.ypos - 25;
							dist = Math.sqrt(dx**2 + dy**2);
							
							if (dist < minDist){
								minDist = dist;
								this.interest = wall;
								this.goal = "MemoryInspect";
								this.timer = new Date().getTime();
							}
						}
					}
				}
				
				break;
			case "MemoryInspect":
				if (new Date().getTime() - this.timer > 3000 || !(this.interest.sta == "alive")){
					this.goal = "TissueResident";
					this.interest = null;
					break;
				}
				dx = this.xpos - this.interest.xpos - 25; dy = this.ypos - this.interest.ypos - 25;
				dist = Math.sqrt(dx**2 + dy**2);
				angle = Math.atan2(-dy, -dx);
				this.orientnuclei(angle, 3);
				if (dist < this.radius + 32){
					this.goal = "MemoryTerminate";
					this.timer = new Date().getTime();
				} else {
					this.xvel += Math.cos(angle);
					this.yvel += Math.sin(angle);
				}
				break;
			case "MemoryTerminate":
				dx = this.xpos - this.interest.xpos - 25; dy = this.ypos - this.interest.ypos - 25;
				dist = Math.sqrt(dx**2 + dy**2);
				angle = Math.atan2(-dy, -dx);
				this.xvel += Math.cos(angle);
				this.yvel += Math.sin(angle);
				this.orientnuclei(angle, 3);
				if (new Date().getTime() - this.timer > 1500){
					this.interest.sta = "Apoptosis";
					this.interest = null;
					this.goal = "TissueResident";
				}
				break;
			case "Prepare To Die":
				if (interferons.length > 0){
					this.goal = "Task";
				} else if (new Date().getTime() - this.timer > 3000){
					if (Math.random() < 0.5){
						this.goal = "TissueResident";
						this.memory = true;
						this.cancross = false;
					} else {
						this.goal = "Die";
					}
				} else {//spread out
					for (const cell of cells){
						if (cell.type1 == "Kcell"){
							[dx, dy, dist] = Distances(this, cell);
							if (dist != 0){
								angle = Math.atan2(dy, dx);
								this.xvel += Math.cos(angle) * 50/ dist;
								this.yvel += Math.sin(angle) * 50/ dist;
							}
						}
					}
				}
				break;
			
			case "Die":
				if (new Date().getTime() - this.timer > 2000){
					this.selfdestruct = true;
				}
				break;
		}
	}
	debugdraw() {
		ctx.save();
		const x = this.xpos; const y = this.ypos; const r = this.radius;
		ctx.beginPath();
		ctx.fillStyle = "#FF0000";
		ctx.ellipse(x, y, r, r, 0, 0, 7);
		ctx.fill();
		ctx.closePath();
		ctx.restore();
	}
	draw() {
		ctx.save();
		const x = this.xpos; const y = this.ypos; const r = this.radius;
		//outer section
		ctx.beginPath();
		ctx.fillStyle = "#FF99CC";
		if (this.memory){
			ctx.fillStyle = "#AA01CC";
		}
		ctx.ellipse(x, y, r, r, 0, 0, 7);
		ctx.fill();
		ctx.closePath();
		//inner section
		ctx.beginPath();
		const inr = r * 0.7;
		ctx.fillStyle = "#FFEE99";
		ctx.ellipse(x, y, inr, inr, 0, 0, 7);
		ctx.fill();
		ctx.closePath();
		//nucleus
		ctx.beginPath();
		const nucleusr = r * 0.4;
		const [lookAngle, lookMag] = this.ndir;
		ctx.fillStyle = this.color;
		ctx.ellipse(x + Math.cos(lookAngle) * lookMag, y + Math.sin(lookAngle) * lookMag, nucleusr, nucleusr, 0, 0, 7);
		ctx.fill();
		ctx.closePath();
		ctx.restore();
	}
}

class DentriticCell extends MobileCell {
	constructor(xpos, ypos){
		super(xpos, ypos);
		this.radius = 30;
		this.goal = "Standby"; //waiting for something to happen?
		this.type1 = "DentriticCell";
		this.timer = 0;
		this.nrotate = 0;
		this.covered = false;
		this.cancross = true;
	}
	tick(room){
		let walls = room.walls;
		let cells = room.cells;
		let viruses = room.viruses.concat(room.antigens);
		let interferons = room.interferons;//cells get access to all the arrays
		let dx = 0; let dy = 0; let dist = 0; let angle = 0;
		switch (this.goal){
			case "Standby":
				this.ndir[1] /= 2;
				let minDist = 150;
				
				for (const virus of viruses){
					[dx, dy, dist] = Distances(this, virus);
					if (dist < minDist){
						this.interest = virus;
						minDist = dist;
						this.goal = "Awake";
						this.timer = new Date().getTime();
					}
				}
				
				for (const cell of cells){
					if (cell.type1 == "DentriticCell"){
						[dx, dy, dist] = Distances(this, cell);
						if (dist != 0){
							angle = Math.atan2(dy, dx);
							this.xvel += Math.cos(angle) * 2 / dist;
							this.yvel += Math.sin(angle) * 2 / dist;
						}
					}
				}
				
				let HeadX = 0; let HeadY = 0;
				for (const iferon of interferons){
					[dx, dy, dist] = Distances(this, iferon);
					if (dist != 0){
						angle = Math.atan2(-dy, -dx);
						dist = Math.max(this.radius, dist);
						HeadX += Math.cos(angle) * 99999 / dist;
						HeadY += Math.sin(angle) * 99999 / dist;
					}
				}
				this.xvel += Math.tanh(HeadX) * 0.1;
				this.yvel += Math.tanh(HeadY) * 0.1;
				
				break;
			case "Awake": //spotting and picking up a virus 
				[dx, dy, dist] = Distances(this, this.interest);
				if (new Date().getTime() - this.timer > 3000 || !this.interest.exists){
					this.goal = "Standby";
					this.interest = null;
					break;
				}
				if (dist < 30){
					this.goal = "Analyzing";
					this.interest.exists = false;
					this.interest = null;
					this.timer = new Date().getTime();
				} else {
					angle = Math.atan2(-dy , -dx);
					this.orientnuclei(angle, 6);
					this.xvel += Math.cos(angle);
					this.yvel += Math.sin(angle);
				}
				break;
			case "Analyzing":
				this.ndir[1] /= 2;
				this.nrotate += 0.1;
				if (new Date().getTime() - this.timer > 2000){
					this.goal = "Alert";
					this.covered = true;
					this.timer = new Date().getTime();
					this.yvel = 1;
					this.xvel = -1;
					this.cancross = true;
					for (let i = 0; i < 4; i++){
						interferons.push(new Interferon(this.xpos, this.ypos, 5000));
					}
				}
				break;
				
			case "Alert": //travel to L-lymph node to find a K-cell
				this.nrotate += 0.1;
				if (this.xvel == 0){
					this.xvel = Math.random();
				} if (this.yvel == 0){
					this.yvel = Math.random();
				}
				this.xvel /= Math.abs(this.xvel) * 0.1;
				this.yvel /= Math.abs(this.yvel) * 0.2;
				const newtime = new Date().getTime();
				this.xvel += Math.sin(newtime/1000);
				if (interferons.length == 0){
					this.timer = newtime;
					this.goal = "Prepare to Die";
				}
				for (const cell of cells){
					if (cell.type1 == "Kcell" && cell.color == "#FF0000"){
						[dx, dy, dist] = Distances(this, cell);
						if (dist < 100){
							this.interest = cell;
							this.goal = "ChaseKcell";
							this.timer = new Date().getTime();
							break;
						}
					}
				}
				break;
			case "ChaseKcell":
				if (this.interest.goal != "Virgin"){
					this.goal = "Alert";
					this.interest = null;
					break;
				}
				this.nrotate += 0.1;
				[dx, dy, dist] = Distances(this, this.interest);
				angle = Math.atan2(-dy, -dx);
				this.xvel += Math.cos(angle);
				this.yvel += Math.sin(angle);
				//if this touches the kcell, then the kcell tells the Dentritic cell to kill itself
				break;
			case "Prepare to Die":
				if (interferons.length){
					this.goal = "Alert";
				} else if (new Date().getTime() - this.timer > 5000){
					this.goal = "Die";
				}
				break;
			case "Die":
				if (new Date().getTime() - this.timer > 2000){
					this.selfdestruct = true;
				}
				break;
				
		}
	}
	draw(){
		ctx.save();
		const x = this.xpos; const y = this.ypos; const r = this.radius;
		//outer section
		ctx.beginPath();
		ctx.fillStyle = "#AAF077";
		ctx.ellipse(x, y, r, r, 0, 0, 7);
		ctx.fill();
		ctx.closePath();
		//inner section
		ctx.beginPath();
		ctx.fillStyle = "#EEEE10";
		const inr = r * 0.65;
		ctx.ellipse(x, y, inr, inr, 0, 0, 7);
		ctx.fill();
		ctx.closePath();
		//nucleus
		ctx.fillStyle = "#3344FF";
		const [lookAngle, lookMag] = this.ndir;
		FillPolygon(x + Math.cos(lookAngle) * lookMag, y + Math.sin(lookAngle) * lookMag, 6, r * 0.3, this.nrotate);
		ctx.fillStyle = "#1122FF";
		FillPolygon(x + Math.cos(lookAngle) * lookMag, y + Math.sin(lookAngle) * lookMag, 6, r * 0.2, this.nrotate);
		//antigens
		if (this.covered){
			ctx.fillStyle = "#FF0000";
			for (let i = 0; i < 8; i++){
				const angle = (i * Math.PI / 4) - this.nrotate;
				ctx.beginPath();
				ctx.ellipse(x + Math.cos(angle) * r, y + Math.sin(angle) * r, 2, 2, 0, 0, 7);
				ctx.fill();
				ctx.closePath();
			}
		}
		ctx.restore();
	}
}

class Macrophage extends MobileCell {
	constructor(xpos, ypos){
		super(xpos, ypos);
		this.radius = 40; 
		this.goal = "Wandering";
		this.type1 = "Macrophage";
		this.timer = 0;
		this.nrotate = 0;
		this.cancross = true;
	}
	tick(room){
		let walls = room.walls;
		let cells = room.cells;
		let viruses = room.viruses.concat(room.antigens);
		let interferons = room.interferons;
		switch (this.goal){
			case "Wandering":
				this.ndir[1] /= 2;
				const newtime = new Date().getTime();
				this.xvel += Math.random() - 0.5 + Math.sin((newtime + this.ypos)/1000) * 0.1;
				this.yvel += Math.random() - 0.5 + Math.cos((newtime + this.xpos)/773) * 0.1;
				let [HeadX, HeadY] = [0, 0];
				for (const iferon of interferons){
					let [dx, dy, dist] = Distances(this, iferon);
					if (dist != 0){
						const angle = Math.atan2(-dy, -dx);
						dist = Math.max(this.radius, dist);
						HeadX += Math.cos(angle) * 99999 / dist;
						HeadY += Math.sin(angle) * 99999 / dist;
					}
				}
				this.xvel += Math.tanh(HeadX) * 0.1;
				this.yvel += Math.tanh(HeadY) * 0.1;
				let minDist = 150
				for (const virus of viruses){
					const [dx, dy, dist] = Distances(this, virus);
					if (dist < minDist){
						this.interest = virus;
						this.goal = "Targeting";
						this.timer = newtime;
						minDist = dist;
						for (let i = 0; i < 5; i++){
							interferons.push(new Interferon(this.xpos, this.ypos, 4000));
						}
					}
				}
				for (const cell in cells){
					if (cell.type1 == "Kcell"){
						const [dx, dy, dist] = Distances(this, cell);
						if (dist < this.radius + cell.radius + 5){
							const angle = Math.atan2(dy, dx);
							Math.xvel += Math.cos(angle);
							Math.yvel += Math.sin(angle);
							this.goal = "Stun";
						}
					}
				}
				break;
			case "Targeting":
				const nt = new Date().getTime();
				if (nt - this.timer > 4000 || !this.interest.exists){
					this.goal = "Wandering";
					this.interest = null;
					break;
				}
				const [dx, dy, dist] = Distances(this, this.interest);
				if (dist < 40){
					this.goal = "Digesting";
					this.interest.exists = false;
					this.interest = null;
					this.timer = nt;
				} else {
					const angle = Math.atan2(-dy, -dx);
					this.orientnuclei(angle, 7);
					this.nrotate = angle;
					this.xvel += Math.cos(angle);
					this.yvel += Math.sin(angle);
				}
				break;
			case "Digesting":
				if (new Date().getTime() - this.timer > 2000){
					this.goal = "Wandering";
					for (let i = 0; i < 4; i++){
						interferons.push(new Interferon(this.xpos, this.ypos));
					}
				} else {
					this.nrotate += 0.1;
					this.ndir[1] /= 2;
				}
				break;
			case "Stun":
				if (new Date().getTime() - this.timer > 2000){
					this.goal = "Wandering";
				}
				break;
		}
	}
	draw(){
		const x = this.xpos; const y = this.ypos; const r = this.radius;
		ctx.save();
		//outer section
		ctx.beginPath();
		ctx.fillStyle = "#DDDC04";
		ctx.ellipse(x, y, r, r, 0, 0, 7);
		ctx.fill();
		ctx.closePath();
		//inner section
		const inr = r * 0.8;
		ctx.beginPath();
		ctx.fillStyle = "#DD9904";
		ctx.ellipse(x, y, inr, inr, 0, 0, 7);
		ctx.fill();
		ctx.closePath();
		//nucleus
		const [lookAngle, lookMag] = this.ndir;
		ctx.fillStyle = "#FF0101";
		FillPolygon(x + Math.cos(lookAngle) * lookMag, y + Math.sin(lookAngle) * lookMag, 3, r * 0.5, this.nrotate);
		ctx.restore();
	}
}

/* //lymph node 1
var lnode = new Room("Left Lymph Node");
const lrect = new Rect(100, 100, 750, 400, "#55FF57", "#50F050", 10); 
const lrecttop = new Rect(300, 0, 100, 100, "#55FF57", "#50F050", 2); 
const lrectright = new Rect(850, 250, 100, 100, "#55FF57", "#50F050", 3);
lnode.rects = [lrect, lrecttop, lrectright];

//lymph node cells
lnode.matrix = [
	[5, 0],
	[5, 1], [4, 1], [3, 1], [2, 1], [1, 1],
	[1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 10],
	[2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10], [12, 10], [13, 10], [14, 10], [15, 10], [16, 10], [17, 10],
	[17, 9], [17, 8], [17, 7],
	[18, 7],
	[18, 4], [17, 4],
	[17, 3], [17, 2], [17, 1],
	[16, 1], [15, 1], [14, 1], [13, 1], [12, 1], [11, 1], [10, 1], [9, 1], [8, 1],
	[8, 0]
]
lnode.walls = WallCollection(lnode.matrix);
lnode.wallInnerColor = "#A0F0A1";
lnode.wallOuterColor = "#20BB23";
 */
//lymph node 2
var rnode = new Room("Lymph Node");
const rrect = new Rect(0, 0, 950, 600, "#55FF57", "#50F050", 10); 
rnode.rects = [rrect];

//lymph node cells
rnode.matrix = [
	[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0], [15, 0], [16, 0], [17, 0], [18, 0],
	[0, 1], [0, 2], [0, 3], [0, 4], [0, 7],
	[5, 1], [4, 1], [3, 1], [2, 1], [1, 1], 
	[1, 2], [1, 3], [1, 4], [1, 7], [1, 8], [1, 9], [1, 10],
	
	
	[2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10], [12, 10], [13, 10], [14, 10], [15, 10], [16, 10], [17, 10],
	[17, 9], [17, 8], [17, 7], [17, 6], [17, 5], [17, 4], [17, 3], [17, 2], 
	[18, 1], [17, 1], [16, 1], [15, 1], [14, 1], [13, 1], [12, 1], [11, 1], [10, 1], [9, 1],
	[18, 2], [18, 3], [18, 4], [18, 5], [18, 6], [18, 7], [18, 8], [18, 9], [18, 10], [18, 11],
	[17, 11], [16, 11], [15, 11], [14, 11], [13, 11], [12, 11], [11, 11], [10, 11], [9, 11], [8, 11], [7, 11], [6, 11], [5, 11], [4, 11], [3, 11], [2, 11], [1, 11], [0, 11], 
	[0, 10], [0, 9], [0, 8] 
];
rnode.walls = WallCollection(rnode.matrix);
rnode.wallInnerColor = "#A0F0A1";
rnode.wallOuterColor = "#20BB23";

//bloodstream
var blood = new Room("Bloodstream");
const artery = new Rect(0, 0, 950, 600, "#AA0202", "#A00000", 7);

blood.rects = [artery];
blood.matrix = [
	[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], 
	[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 10], [1, 11], 
	[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10], [2, 11], 
	[3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [3, 11], 
	[4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10], [4, 11], 
	[5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [5, 6], [5, 7], [5, 8], [5, 9], [5, 10], [5, 11],
	[6, 9], [6, 10], [6, 11],
	
	[12, 9], [12, 10], [12, 11],
	[13, 0], [13, 1], [13, 2], [13, 3], [13, 4], [13, 7], [13, 8], [13, 9], [13, 10], [13, 11], 
	[14, 0], [14, 1], [14, 2], [14, 3], [14, 4], [14, 7], [14, 8], [14, 9], [14, 10], [14, 11], 
	[15, 0], [15, 1], [15, 2], [15, 3], [15, 4], [15, 7], [15, 8], [15, 9], [15, 10], [15, 11], 
	[16, 0], [16, 1], [16, 2], [16, 3], [16, 4], [16, 7], [16, 8], [16, 9], [16, 10], [16, 11], 
	[17, 0], [17, 1], [17, 2], [17, 3], [17, 4], [17, 7], [17, 8], [17, 9], [17, 10], [17, 11], 
	[18, 0], [18, 1], [18, 2], [18, 3], [18, 4], [18, 7], [18, 8], [18, 9], [18, 10], [18, 11]
];
blood.walls = WallCollection(blood.matrix);
blood.wallInnerColor = "#FF99AA";
blood.wallOuterColor = "#701111";

//lungs
var lungs = new Room("Alveoli");
const vein = new Rect(0, 0, 950, 600, "#AA0202", "#A00000", 30);
const alveoli = new Rect(100, 0, 750, 400, "#FFDEDD", "#F0D0D0", 0);
lungs.rects = [vein, alveoli];
lungs.matrix = [
	[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7],
	[16, 0], [16, 1], [16, 2], [16, 3], [16, 4], [16, 5], [16, 6], [16, 7],
	[3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [12, 7], [13, 7], [14, 7], [15, 7]
];
lungs.walls = WallCollection(lungs.matrix);
lungs.wallInnerColor = "#FFAACC";
lungs.wallOuterColor = "#701111";

//lymph node 2 connections
rnode.connections = {
	left: {room: blood, pos: [950, 300]},
	right: null,
	up: {room: blood, pos: [475, 600]},
	down: null
}

//blood connections
blood.connections = {
	left: null,
	right: {room: rnode, pos: [0, 300]},
	up: {room: lungs, pos: [475, 600]},
	down: {room: rnode, pos: [375, 0]}
}

//lungs connections
lungs.connections = {
	left: null,
	right: null, 
	up: null,
	down: {room: blood, pos: [475, 0]}
}

var cyclerooms = [blood, lungs, rnode];
var camindex = 1;
var focusroom = cyclerooms[camindex];

var mouse = {
	x : 0,
	y : 0
}

keytimeout = false;

canvas.addEventListener("mousemove", function(e) {
	mouse.x = e.x;
	mouse.y = e.y;
})

canvas.addEventListener("keydown", function(e) {
	if (!keytimeout) {
		keytimeout = true;
		switch (e.key) {
			case "q":
				camindex -= 1;
				camindex = Math.min(Math.max(0, camindex), 2);
				break;
			case "e":
				camindex += 1;
				camindex = Math.min(Math.max(0, camindex), 2);
				break;
			case "v":
				focusroom.viruses.push(new Virus(mouse.x, mouse.y));
				break;
			case "a":
				focusroom.antigens.push(new Antigen(mouse.x, mouse.y));
				break;
			case " ":
				camindex = 0;
				for (let i = 0; i < 30; i++){
					blood.antigens.push(new Antigen(475, 300));
					lungs.antigens.push(new Antigen(25, 300));
					lungs.antigens.push(new Antigen(925, 300));
					lungs.interferons.push(new Interferon(25, 300, 30000));
					lungs.interferons.push(new Interferon(925, 300, 30000));
				}
			/* 			case "m":
							let newcell = new Kcell(475, 300);
							newcell.xvel = 20 * (Math.random() - 0.5);
							newcell.yvel = 20 * (Math.random() - 0.5);
							lnode.cells.push(newcell);
							break; */
		}
		setTimeout(function() { keytimeout = false }, 200);
	}
}, false);

for (let i = 0; i < 2; i++) {
	let newcell = new DentriticCell(475, 400);
	newcell.ypos += 200 * (Math.random() - 0.5);
	blood.cells.push(newcell);
}
lungs.cells.push(new DentriticCell(475, 525));
lungs.cells.push(new DentriticCell(20, 200));
lungs.cells.push(new DentriticCell(930, 200));
lungs.cells.push(new Macrophage(475, 200));
lungs.cells.push(new Macrophage(0, 100));


blood.cells.push(new Macrophage(475, 200));

for (let i = 0; i < 20; i++) {
	let newcell = new Kcell(475, 300);
	newcell.xpos += 200 * (Math.random() - 0.5);
	newcell.ypos += 200 * (Math.random() - 0.5);
	if (Math.random() < 0.2){
		newcell.memory = true;
		newcell.goal = "Memory";
	}
	rnode.cells.push(newcell);
}
let newcell = new Kcell(300, 300);
newcell.type = [255, 0, 0];
newcell.color = "#FF0000";
rnode.cells.push(newcell);

function mainloop() {

	for (const runroom of cyclerooms) {
		try{
			runroom.tick();
		} catch (err){
			alert(err);
		}
	}

	focusroom = cyclerooms[camindex];
	focusroom.draw();
	
	ctx.save();
	ctx.fillStyle = "#000000";
	ctx.globalAlpha = 0.5;
	ctx.fillRect(0, 550, 950, 50);
	ctx.fillRect(0, 0, 950, 50);
	ctx.globalAlpha = 1;
	
	ctx.textAlign = "center";
	ctx.font = "bold 20px sans-serif";
	for (let i in cyclerooms){
		let textx = 475 + (i - 1) * 225;
		if (i == camindex){
			ctx.fillStyle = "#00FF00";
		} else {
			ctx.fillStyle = "#FFFFFF";
		}
		ctx.fillText(cyclerooms[i].type, textx, 580);
	}
	ctx.fillStyle = "#FFFFFF";
	ctx.fillText("[Q]", 150, 580);
	ctx.fillText("[E]", 800, 580);
	
	ctx.textAlign = "left";
	ctx.fillText("Press [Space] to Vaccinate or [V] to plot Virus. Experiment!", 5, 30);
	
	if (damages > 100){
		ctx.fillStyle = "#FF0000";
	}
	ctx.textAlign = "right";
	ctx.fillText("Casualties: "+damages.toString(), 940, 30);
	
	ctx.restore();
}

setInterval(mainloop, 50);