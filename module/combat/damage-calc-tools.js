import { debug, log } from "../ptu.js";

Hooks.on("renderChatMessage", (message, html, data) => {
    setTimeout(() => {
        $(html).find(".apply-damage-button").on("click", game.ptu.combat.applyDamageToTargets);
        $(html).find(".undo-damage-button").on("click", game.ptu.combat.undoDamageToTargets);
        $(html).find(".half-damage-button").on("click", (ev) => game.ptu.combat.applyDamageToTargets(ev, ATTACK_MOD_OPTIONS.HALF));
        $(html).find(".resist-damage-button").on("click", (ev) => game.ptu.combat.applyDamageToTargets(ev, ATTACK_MOD_OPTIONS.RESIST));
        $(html).find(".flat-damage-button").on("click", (ev) => game.ptu.combat.applyDamageToTargets(ev, ATTACK_MOD_OPTIONS.FLAT));
        $(html).find(".automated-damage-button").click(game.ptu.combat.newApplyDamageToTargets)
        $(html).find(".mon-item").click(game.ptu.combat.handleApplicatorItem)
    }, 500);
});

const ATTACK_MOD_OPTIONS = {
    NONE: 0,
    HALF: 1,
    RESIST: 2,
    FLAT: 3
}

export async function applyDamageToTargets(event, options = ATTACK_MOD_OPTIONS.NONE) {
    event.preventDefault();
    if (event.target != event.currentTarget) return;

    const dataset = event.currentTarget.dataset.moveName ? event.currentTarget.dataset : event.currentTarget.parentElement.parentElement.dataset;

    const moveData = {
        moveName: dataset.moveName,
        type: dataset.type,
        category: dataset.category,
        regDamage: dataset.regDamage,
        critDamage: dataset.critDamage,
        isCrit: dataset.isCrit == "true"
    }

    let targeted_tokens = canvas.tokens.controlled;
    if (targeted_tokens?.length == 0) return;

    let dr = 0;

    if (event.shiftKey) {
        dr = await new Promise((resolve, reject) => {
            Dialog.confirm({
                title: `Apply Damage Reduction`,
                content: `<input type="number" name="damage-reduction" value="0"></input>`,
                yes: (html) => resolve(parseInt(html.find('input[name="damage-reduction"]').val()))
            });
        });
    }

    if (options > 0) {
        switch (options) {
            case ATTACK_MOD_OPTIONS.HALF:
                return executeApplyDamageToTargets(canvas.tokens.controlled, moveData, !moveData.isCrit ? Math.max(1, Math.floor(moveData.regDamage / 2)) : Math.max(1, Math.floor(moveData.critDamage / 2)), { damageReduction: dr });
            case ATTACK_MOD_OPTIONS.RESIST:
                return executeApplyDamageToTargets(canvas.tokens.controlled, moveData, !moveData.isCrit ? moveData.regDamage : moveData.critDamage, { isResist: true, damageReduction: dr });
            case ATTACK_MOD_OPTIONS.FLAT:
                return executeApplyDamageToTargets(canvas.tokens.controlled, moveData, !moveData.isCrit ? moveData.regDamage : moveData.critDamage, { isFlat: true, damageReduction: dr })

        }
        return;
    }

    return executeApplyDamageToTargets(canvas.tokens.controlled, moveData, !moveData.isCrit ? moveData.regDamage : moveData.critDamage, { damageReduction: dr });
}

export async function ApplyFlatDamage(targets, sourceName, damage) {
    return executeApplyDamageToTargets(targets, { moveName: sourceName }, damage, { isFlat: true })
}

async function executeApplyDamageToTargets(targets, data, damage, { isFlat, isResist, isWeak, damageReduction, msgId } = { isFlat: false, isResist: false, isWeak: false }) {
    if (isNaN(damageReduction)) damageReduction = 0;

    return await game.ptu.api.applyDamage(targets, damage, data.type, data.category, {isFlat, isResist, isWeak, damageReduction, msgId});
    // let appliedDamage = {};
    // for (let target of targets) {
    //     // if (target.actor.data.permission[game.userId] < 3) continue;

    //     let actualDamage;
    //     if (isFlat) {
    //         actualDamage = damage;
    //     }
    //     else {
    //         const defense = data.category == "Special" ? target.actor.data.data.stats.spdef.total : target.actor.data.data.stats.def.total;
    //         const dr = parseInt(data.category == "Special" ? (target.actor.data.data.modifiers?.damageReduction?.special?.total ?? 0) : (target.actor.data.data.modifiers?.damageReduction?.physical?.total ?? 0));

    //         const effectiveness = target.actor.data.data.effectiveness?.All[data.type] ?? 1;

    //         actualDamage = Math.max(
    //             effectiveness === 0 ? 0 : 1,
    //             Math.floor((damage - parseInt(defense) - dr - parseInt(damageReduction)) * (effectiveness + (isResist ? (effectiveness > 1 ? -0.5 : effectiveness * -0.5) : isWeak ? (effectiveness >= 1 ? effectiveness >= 2 ? 1 : 0.5 : effectiveness) : 0)))
    //         )
    //     }

    //     log(`Dealing ${actualDamage} damage to ${target.name}`);
    //     appliedDamage[target.data.actorLink ? target.actor.id : target.data._id] = {
    //         name: target.actor.data.name,
    //         damage: actualDamage,
    //         type: target.data.actorLink ? "actor" : "token",
    //         old: {
    //             value: duplicate(target.actor.data.data.health.value),
    //             temp: duplicate(target.actor.data.data.tempHp.value)
    //         },
    //         tokenId: target.id,
    //         msgId,
    //     };

    //     await game.ptu.api.applyDamage(target, actualDamage * -1, )
    //     // await target.actor.modifyTokenAttribute("health", actualDamage * -1, true, true);
    // }
    // return await displayAppliedDamageToTargets({ data: appliedDamage, move: data.moveName });
}

export async function displayAppliedDamageToTargets(appliedDamage) {
    let messageData = {
        user: game.user.id,
        content: await renderTemplate("/systems/ptu/templates/chat/automation/applied-damage.hbs", appliedDamage),
        type: CONST.CHAT_MESSAGE_TYPES.WHISPER,
        whisper: game.users.filter(x => x.isGM)
    }

    return ChatMessage.create(messageData, {});
}

export async function undoDamageToTargets(event) {
    event.preventDefault();

    const data = {
        target: event.currentTarget.dataset.target,
        type: event.currentTarget.dataset.targetType,
        oldHp: parseInt(event.currentTarget.dataset.oldValue),
        oldTempHp: parseInt(event.currentTarget.dataset.oldTemp),
        damage: parseInt(event.currentTarget.dataset.damage),
        tokenId: event.currentTarget.dataset.tokenTarget,
        msgId: event.currentTarget.dataset.originMessage,
    }

    const actor = data.type == "actor" ? game.actors.get(data.target) : canvas.tokens.get(data.target).actor;
    if (!actor) return;


    log(`FVTT PTU | Undoing ${data.damage} damage to ${actor.data.name} - Old HP: ${data.oldHp} - Old Temp: ${data.oldTempHp}`);
    await actor.update({ "data.health.value": data.oldHp, "data.tempHp.value": data.oldTempHp, "data.tempHp.max": data.oldTempHp })

    if (data.tokenId && data.msgId) {
        await updateApplicatorHtml($(`[data-message-id="${data.msgId}"]`), [data.tokenId], undefined, true, true)
    }

}

export async function newApplyDamageToTargets(event) {
    let dataset;
    if (event.hasDataset) dataset = event;
    else {
        event.preventDefault();
        if (event.target != event.currentTarget) return;

        dataset = event.currentTarget.dataset.moveName ? event.currentTarget.dataset : event.currentTarget.parentElement.parentElement.dataset;
    }

    const moveData = {
        target: dataset.target,
        moveName: dataset.moveName,
        type: dataset.type,
        category: dataset.category,
        damage: dataset.damage,
        mode: dataset.mode,
        crit: dataset.crit == "true"
    }

    let dr = 0;

    // Figure out which to target from multi-attack
    if (moveData.target === "many") {
        const messageHtml = $(event.currentTarget).closest(".chat-message.message");
        const targets = [];
        const critTargets = [];
        messageHtml.find(".mon-list").filter((k, i) => !i.className.includes("disabled")).each((k, i) => {
            const token = canvas.tokens.get(i?.dataset?.target);
            console.log(token.name, i.dataset, i.dataset.hit, i.dataset.hit == 'true')
            if (token && (i.dataset.hit == 'true')) {
                if (i.dataset.crit == "hit" || i.dataset.crit == "double-hit")
                    critTargets.push(token);
                else
                    targets.push(token);
            }
        })
        if (targets.length == 0 && critTargets.length == 0) return;

        if (event.shiftKey) {
            dr = await new Promise((resolve, reject) => {
                Dialog.confirm({
                    title: `Apply Damage Reduction`,
                    content: `<input type="number" name="damage-reduction" value="0"></input>`,
                    yes: (html) => resolve(parseInt(html.find('input[name="damage-reduction"]').val()))
                });
            });
        }

        const r = [];

        // Normal Damage
        if (targets.length != 0) {
            moveData.target = targets;
            r.push(await applyResult(targets, moveData.damage, messageHtml[0].dataset.messageId));
        }

        // Crit Damage
        if (critTargets.length != 0) {
            moveData.target = targets;
            moveData.damage = dataset.critDamage
            r.push(await applyResult(critTargets, moveData.damage, messageHtml[0].dataset.messageId));
        }

        await updateApplicatorHtml(messageHtml, targets.concat(critTargets).map(t => t.id), moveData.mode, true);

        return r;
    }

    moveData.target = canvas.tokens.get(moveData.target) ? [canvas.tokens.get(moveData.target)] : false;
    if (!moveData.target) moveData.target = canvas.tokens.controlled;
    if (!moveData.target) return;

    if (event.shiftKey) {
        dr = await new Promise((resolve, reject) => {
            Dialog.confirm({
                title: `Apply Damage Reduction`,
                content: `<input type="number" name="damage-reduction" value="0"></input>`,
                yes: (html) => resolve(parseInt(html.find('input[name="damage-reduction"]').val()))
            });
        });
    }

    return await applyResult(moveData.target, moveData.damage, dataset.messageId);

    function applyResult(targets, damage, messageId) {
        switch (moveData.mode) {
            case "full":
                return executeApplyDamageToTargets(targets, moveData, damage, { damageReduction: dr, msgId: messageId });
            case "weak":
                return executeApplyDamageToTargets(targets, moveData, damage, { isWeak: true, damageReduction: dr, msgId: messageId });
            case "resist":
                return executeApplyDamageToTargets(targets, moveData, damage, { isResist: true, damageReduction: dr, msgId: messageId });
            case "half":
                return executeApplyDamageToTargets(targets, moveData, Math.max(1, (damage / 2)), { damageReduction: dr, msgId: messageId });
            case "flat":
                return executeApplyDamageToTargets(targets, moveData, damage, { isFlat: true, damageReduction: dr, msgId: messageId })
        }
    }
}

export async function handleApplicatorItem(event) {
    event.preventDefault();

    const parent = event.currentTarget.parentElement;
    const currentTarget = event.currentTarget;
    const child = event.currentTarget.children[0];
    const target = event.target;

    if (parent.className.includes("disabled")) return;

    const missClass = "tooltip far fa-times-circle";
    const hitClass = "tooltip fas fa-certificate";
    const critClass = "tooltip fas fa-crosshairs";
    const tooltipContent = (content) => `<span class="tooltip-content">${content}</span>`;
    const messageHtml = $(parent).closest(".chat-message.message");
    const messageId = messageHtml[0].dataset.messageId;
    
    if (currentTarget.className.includes("icon")) {
        return;
    }
    if (currentTarget.className.includes("hit")) {
        if (parent.dataset.hit == "true") {
            parent.dataset.hit = false;
            child.className = missClass;
            child.innerHTML = tooltipContent("Miss<br>(click to toggle)")
        }
        else {
            parent.dataset.hit = true;
            child.className = hitClass;
            child.innerHTML = tooltipContent("Hit<br>(click to toggle)")
        }
    }
    if (currentTarget.className.includes("crit")) {
        if (parent.dataset.crit != "normal") {
            parent.dataset.crit = "normal";
            child.className = missClass;
            child.innerHTML = tooltipContent("Not a Crit<br>(click to toggle)")
        }
        else {
            parent.dataset.crit = "crit";
            child.className = critClass;
            child.innerHTML = tooltipContent("Crit<br>(click to toggle)")
        }
    }
    if (currentTarget.className.includes("applicators")) {
        if (!target.dataset.mode) return;

        const baseDataset = parent.parentElement.dataset;

        await updateApplicatorHtml(messageHtml, [parent.dataset.target], target.dataset.mode)

        const data = {
            target: parent.dataset.target,
            moveName: baseDataset.moveName,
            type: baseDataset.type,
            category: baseDataset.category,
            damage: baseDataset.damage,
            mode: target.dataset.mode,
            crit: parent.dataset.crit == "hit" || parent.dataset.crit == "double-hit",
            hasDataset: true,
            messageId
        }
        if (data.crit) data.damage = baseDataset.critDamage;
        await newApplyDamageToTargets(data)
    }
    const message = game.messages.get(messageId);
    const newContent = messageHtml.children(".message-content").html().trim();

    await game.ptu.api.chatMessageUpdate(message, { content: newContent })
}

async function updateApplicatorHtml(root, targetIds, mode, updateChatMessage = false, undo = false) {
    const applicatorHTML = {
        normal:
            `<i class="tooltip fas fa-circle" data-mode="full">
                <span class="tooltip-content">Apply Normal</span>
            </i>`,
        half:
            `<i class="tooltip fas fa-adjust" data-mode="half">
                <span class="tooltip-content">Apply Half</span>
            </i>`,
        weak:
            `<i class="tooltip fas fa-minus-square" data-mode="weak">
                <span class="tooltip-content">Apply Resist Less</span>
            </i>`,
        resist:
            `<i class="tooltip fas fa-plus-square" data-mode="resist">
                <span class="tooltip-content">Apply Resist More</span>
            </i>`,
        flat:
            `<i class="tooltip fas fa-stop" data-mode="flat">
                <span class="tooltip-content">Apply Flat</span>
            </i>`,
    }

    for (const target of targetIds) {
        const monList = $(root).find(`[data-target="${target}"]`)
        if (undo) {
            monList.removeClass("disabled");
            monList.children(".applicators").html(applicatorHTML.normal + "\n" + applicatorHTML.half + "\n" + applicatorHTML.weak + "\n" + applicatorHTML.resist+ "\n" + applicatorHTML.flat);
        }
        else {
            monList.addClass("disabled");

            switch (mode) {
                case "full":
                    monList.children(".applicators").html(applicatorHTML.normal);
                    break;
                case "half":
                    monList.children(".applicators").html(applicatorHTML.half);
                    break;
                case "weak":
                    monList.children(".applicators").html(applicatorHTML.weak);
                    break;
                case "resist":
                    monList.children(".applicators").html(applicatorHTML.resist);
                    break;
                case "flat":
                    monList.children(".applicators").html(applicatorHTML.flat);
                    break;
            }
        }
    }
    if (updateChatMessage) {
        const messageId = $(root)[0].dataset.messageId;
        const message = game.messages.get(messageId);
        const newContent = $(root).children(".message-content").html().trim();

        await game.ptu.api.chatMessageUpdate(message, { content: newContent })
    }
}