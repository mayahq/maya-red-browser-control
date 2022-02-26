const evaluateQuery = require('../../utils/webql')

module.exports = function (RED) {
	"use strict";
	const { getValue } = require("../../utils/getValue");
	const jsonata = require("jsonata");
	function MayaBrowserQuery(config) {
		// Scrape Node for Maya Red Web Automation
		RED.nodes.createNode(this, config);
		this.options = config.options;
		this.pageId = config.pageId;
		this.payloadTypePageId = config.payloadTypePageId;
		this.timeout = config.timeout;
		this.payloadTypeTimeout = config.payloadTypeTimeout;
		this.mergeOutputs = config.mergeOutputs;
		const node = this;

		this.on("input", async (msg) => {
			const context = node.context()

			let pageId = await getValue(this.pageId, this.payloadTypePageId, msg, RED);
			let timeout = await getValue(
				this.timeout,
				this.payloadTypeTimeout,
				msg,
				RED
			);
			let query = {};
			this.options.forEach((q) => {
				query[q["key"]] = [q["xpath"] + q["extract"]];
			});

			const pages = context.flow.get(`_pages::${msg._msgid}`)
			const pupPage = pages[pageId]

			try {

				const res = await evaluateQuery(pupPage, query, timeout)
				if (this.mergeOutputs) {
					const initialData = res;
					let listOkeys = Object.keys(initialData);
					let zipArgs = "";
					let objectArg = "";
					let count = 0;
					listOkeys.forEach((key) => {
						zipArgs += `$.${key}, `;
						objectArg += `"${key}":$x[${count}],`;
						count++;
					});
					zipArgs = zipArgs.slice(0, -2);
					try {
						let expression = `
							$map($zip(${zipArgs}), function($x, $i, $a) {
								{
									${objectArg.slice(0, -1)}
								}
							})`

						let jsonataExp = jsonata(expression);
						msg.result = jsonataExp.evaluate(res);
						node.send(msg);
					} catch (error) {
						msg.__error = error;
						msg.__isError = true;
						console.error("Error in merging", msg.error);
						node.send(msg);
					}
				} else {
					msg.result = res
					node.send(msg);
				}
			} catch (err) {
				node.error(err);
				node.status({
					fill: "red",
					shape: "ring",
					text: "error: " + err,
				});
				msg.__error = err;
				msg.__isError = true;
				node.send(msg);
			}
		});
	}
	RED.nodes.registerType("maya-puppeteer-query", MayaBrowserQuery);
};
