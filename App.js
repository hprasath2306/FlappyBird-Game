import React, { useEffect, useState } from "react";
import { Canvas, Group, matchFont } from "@shopify/react-native-skia";
import { useWindowDimensions } from "react-native";
import { useImage, Image, Text } from "@shopify/react-native-skia";
import {
  useSharedValue,
  withTiming,
  Easing,
  withSequence,
  withRepeat,
  useFrameCallback,
  useDerivedValue,
  interpolate,
  Extrapolation,
  useAnimatedReaction,
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";

const GRAVITY = 1000;
const JUMP_FORCE = -500;

const pipeHeight = 640;
const pipeWeight = 104;

const App = () => {
  const { width, height } = useWindowDimensions();
  const [score, setScore] = useState(0);

  const bg = useImage(require("./assets/sprites/background-night.png"));
  const bird = useImage(require("./assets/sprites/bluebird-upflap.png"));
  const pipe = useImage(require("./assets/sprites/pipe-red.png"));
  const pipeTop = useImage(require("./assets/sprites/pipe-red-top.png"));
  const base = useImage(require("./assets/sprites/base.png"));

  const x = useSharedValue(width);
  const birdX = width/4;
  const birdY = useSharedValue(height / 3);
  const birdYVelocity = useSharedValue(0);
  const gameOver = useSharedValue(true);

  const birdTransform = useDerivedValue(() => {
    return [
      {
        rotate: interpolate(
          birdYVelocity.value,
          [-500, 500],
          [-0.5, 0.5],
          Extrapolation.CLAMP
        ),
      },
    ];
  });

  const birdOrigin = useDerivedValue(() => {
    return { x: width / 4 + 32, y: birdY.value + 24 };
  });
  useEffect(() => {
    moveTheMap();
  }, []);

  const pipesSpeed = useDerivedValue(()=>{
    return interpolate(score,[0,20],[1,2])
  })

  const moveTheMap = () => {
    x.value = 
      withSequence(
        withTiming(width, { duration: 0 }),
        withTiming(-150, { duration: 3000 / pipesSpeed.value, easing: Easing.linear }),
        withTiming(width, { duration: 0 })
    );
  };


  const birdCenterX = useDerivedValue(() => birdX + 32);
  const birdCenterY = useDerivedValue(() => birdY.value + 24);
  const pipeOffset = useSharedValue(0);

  const topPipeY = useDerivedValue(() => pipeOffset.value - 320);
  const bottomPipeY = useDerivedValue(() => height - 320 + pipeOffset.value);


  const obstacles = useDerivedValue(() => {
    const allObstacles = [];

    allObstacles.push({
      x: x.value,
      y: bottomPipeY.value,
      h: pipeHeight,
      w: pipeWeight,
    });

    allObstacles.push({
      x: x.value,
      y: pipeOffset.value - 320,
      h: pipeHeight,
      w: pipeWeight,
    });

    return allObstacles;
  });

  useAnimatedReaction(
    () => {
      return x.value;
    },
    (currentValue, previousValue) => {
      const middle = birdX;

      if (previousValue && currentValue < -100 && previousValue > -100) {
        pipeOffset.value = Math.random() * 400 - 200;
        cancelAnimation(x);
        runOnJS(moveTheMap)()
      }

      if (
        currentValue !== previousValue &&
        previousValue &&
        currentValue <= middle &&
        previousValue > middle
      ) {
        runOnJS(setScore)(score + 1);
      }
    }
  );

  const isPointCollidingWithRecct = (point, rect) => {
    "worklet";

    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.w &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.h
    );
  };

  useAnimatedReaction(
    () => birdY.value,
    (currentValue, previousValue) => {
      if (currentValue > height - 100 || currentValue < 0) {
        gameOver.value = true;
      }

      const isColliding = obstacles.value.some((rect) =>
        isPointCollidingWithRecct(
          { x: birdCenterX.value, y: birdCenterY.value },
          rect
        )
      );
      if (isColliding) gameOver.value = true;
    }
  );

  useAnimatedReaction(
    () => gameOver.value,
    (currentValue, previousValue) => {
      if (currentValue && !previousValue) {
        cancelAnimation(x);
      }
    }
  );

  useFrameCallback(({ timeSincePreviousFrame: dt }) => {
    if (!dt || gameOver.value) {
      return;
    }
    birdY.value = birdY.value + (birdYVelocity.value * dt) / 1000;
    birdYVelocity.value = birdYVelocity.value + (GRAVITY * dt) / 1000;
  });

  const restartGame = () => {
    "worklet";
    birdY.value = height / 3;
    birdYVelocity.value = 0;
    gameOver.value = false;
    x.value = width;
    // console.log(gameOver)
    runOnJS(moveTheMap)();
    runOnJS(setScore)(0);
  };

  const gesture = Gesture.Tap().onStart(() => {
    if (gameOver.value) {
      restartGame();
    } else {
      birdYVelocity.value = JUMP_FORCE;
    }
  });

  const fontStyle = {
    fontFamily: "serif",
    fontSize: 30,
    fontWeight: "600",
  };

  const font = matchFont(fontStyle);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={gesture}>
        <Canvas style={{ width, height:1000 }}>
          <Image image={bg} width={width} height={height} fit={"cover"} />
          <Image
            image={pipe}
            y={bottomPipeY}
            x={x}
            width={pipeWeight}
            height={pipeHeight}
          />
          <Image
            image={pipeTop}
            y={topPipeY}
            x={x}
            width={pipeWeight}
            height={pipeHeight}
          />
          <Image
            image={base}
            width={width}
            height={150}
            y={height - 75}
            x={0}
            fit={"cover"}
          />
          <Group transform={birdTransform} origin={birdOrigin}>
            <Image
              image={bird}
              width={42}
              height={48}
              x={birdX}
              y={birdY}
            />
          </Group>

          <Text
            x={width / 3}
            y={100}
            text={"Score : " + score.toString()}
            font={font}
          />
        </Canvas>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

export default App;
